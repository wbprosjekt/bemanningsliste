"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Document, PDFDownloadLink } from "@react-pdf/renderer";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { CoverPage } from "./CoverPage";
import { TableOfContents } from "./TableOfContents";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { StandardReportLayout } from "./StandardReportLayout";
import { FriBefaringReportLayout } from "./FriBefaringReportLayout";
import { SignaturPage } from "./SignaturPage";
import type {
  BefaringReportData,
  ReportBefaring,
  ReportImage,
  ReportPunkt,
  ReportType,
  ReportPlantegning,
  ReportStats,
  ReportOppgave,
} from "./types";

interface BefaringReportPDFProps {
  befaringId: string;
  label?: string;
}

export default function BefaringReportPDF({ befaringId, label = "Last ned PDF" }: BefaringReportPDFProps) {
  const [data, setData] = useState<BefaringReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReportData(befaringId);
      setData(result);
    } catch (err) {
      console.error("Failed to load PDF data", err);
      setError(err instanceof Error ? err.message : "Ukjent feil under lasting av rapport");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [befaringId]);

  useEffect(() => {
    if (befaringId) {
      loadData();
    }
  }, [befaringId, loadData]);

  const reportId = useMemo(() => `BR-${befaringId.slice(0, 8).toUpperCase()}`, [befaringId]);

  if (loading && !data) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Forbereder rapport…
      </Button>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-500">{error}</span>
        <Button size="sm" variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Prøv igjen
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <PDFDownloadLink
      document={<ReportDocument data={data} reportId={reportId} />}
      fileName={`befaring-${befaringId}.pdf`}
      className="inline-flex w-full"
    >
      {({ loading: linkLoading }) => (
        <Button className="w-full" disabled={linkLoading}>
          {linkLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Genererer PDF…
            </>
          ) : (
            label
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

function ReportDocument({ data, reportId }: { data: BefaringReportData; reportId: string }) {
  return (
    <Document>
      <CoverPage befaring={data.befaring} reportId={reportId} />
      <TableOfContents data={data} />
      <ExecutiveSummary data={data} />
      {data.type === "standard" ? (
        <StandardReportLayout plantegninger={data.plantegninger} />
      ) : (
        <FriBefaringReportLayout punkter={data.befaringspunkter} />
      )}
      <SignaturPage befaring={data.befaring} reportId={reportId} />
    </Document>
  );
}

async function fetchReportData(befaringId: string): Promise<BefaringReportData> {
  const standard = await loadStandardBefaring(befaringId);
  if (standard) {
    return standard;
  }

  const fri = await loadFriBefaring(befaringId);
  if (fri) {
    return fri;
  }

  throw new Error("Fant ikke befaring med angitt ID");
}

async function loadStandardBefaring(befaringId: string): Promise<BefaringReportData | null> {
  const { data, error } = await supabase
    .from("befaringer")
    .select(
      `
        *,
        ttx_project_cache ( project_name ),
        plantegninger (
          *,
          oppgaver (
            *,
            oppgave_bilder (*)
          )
        )
      `,
    )
    .eq("id", befaringId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const plantegninger: ReportPlantegning[] =
    (data.plantegninger || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      image_url: p.image_url,
      display_order: p.display_order,
      oppgaver: (p.oppgaver || []).map(mapOppgave),
    })) ?? [];

  const allOppgaver = plantegninger.flatMap((p) => p.oppgaver ?? []);
  const stats = buildStats(allOppgaver);

  const befaring = mapBefaringRecord(data, {
    project_name: data.ttx_project_cache?.project_name,
  });

  return {
    type: "standard",
    befaring,
    plantegninger,
    stats,
  };
}

async function loadFriBefaring(befaringId: string): Promise<BefaringReportData | null> {
  const { data, error } = await supabase
    .from("fri_befaringer" as any)
    .select(
      `
        *,
        befaring_punkter (
          *,
          oppgave_bilder (*)
        )
      `,
    )
    .eq("id", befaringId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const punkter: ReportPunkt[] = ((data as any)?.befaring_punkter || []).map((punkt: any) => ({
    id: punkt.id,
    punkt_nummer: punkt.punkt_nummer,
    title: punkt.title,
    description: punkt.description,
    status: punkt.status,
    fag: punkt.fag,
    prioritet: punkt.prioritet,
    created_at: punkt.created_at,
    images: mapImages(punkt.oppgave_bilder),
  }));

  const stats = buildStats(punkter);
  const befaring = mapBefaringRecord(data, {});

  return {
    type: "fri_befaring",
    befaring,
    befaringspunkter: punkter,
    stats,
  };
}

function mapBefaringRecord(record: any, extras: Partial<ReportBefaring>): ReportBefaring {
  return {
    id: record.id,
    title: record.title ?? "Uten tittel",
    befaring_type: record.befaring_type,
    befaring_date: record.befaring_date,
    adresse: record.adresse,
    postnummer: record.postnummer,
    sted: record.sted,
    status: record.status,
    project_name: extras.project_name ?? record.project_name ?? null,
    tripletex_project_id: record.tripletex_project_id ?? null,
    performedBy: record.performed_by ?? null,
    dateFormatted: record.befaring_date
      ? format(new Date(record.befaring_date), "PPP", { locale: nb })
      : undefined,
  };
}

function mapOppgave(oppgave: any): ReportOppgave {
  return {
    id: oppgave.id,
    oppgave_nummer: oppgave.oppgave_nummer,
    title: oppgave.title,
    description: oppgave.description,
    status: oppgave.status,
    fag: oppgave.fag,
    fag_color: oppgave.fag_color,
    x_position: oppgave.x_position,
    y_position: oppgave.y_position,
    prioritet: oppgave.prioritet,
    images: mapImages(oppgave.oppgave_bilder),
  };
}

function mapImages(images: any[] | null | undefined): ReportImage[] {
  if (!images) return [];
  return images.map((image) => ({
    id: image.id,
    image_url: image.image_url,
    image_type: image.image_type,
  }));
}

function buildStats(items: Array<{ status?: string | null; prioritet?: string | null }>): ReportStats {
  const openStatuses = ["apen", "aktiv"];
  const inProgressStatuses = ["under_arbeid"];
  const closedStatuses = ["lukket", "signert"];

  const normalize = (status?: string | null) => status ?? "apen";

  return {
    totalItems: items.length,
    openCount: items.filter((item) => openStatuses.includes(normalize(item.status))).length,
    inProgressCount: items.filter((item) => inProgressStatuses.includes(normalize(item.status))).length,
    closedCount: items.filter((item) => closedStatuses.includes(normalize(item.status))).length,
    criticalCount: items.filter((item) => item.prioritet === "kritisk").length,
  };
}
