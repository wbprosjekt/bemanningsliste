export interface ReportImage {
  id: string;
  image_url: string;
  image_type?: string | null;
}

export interface ReportOppgave {
  id: string;
  oppgave_nummer?: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  fag?: string | null;
  fag_color?: string | null;
  x_position?: number | null;
  y_position?: number | null;
  images?: ReportImage[];
  prioritet?: string | null;
}

export interface ReportPlantegning {
  id: string;
  title?: string | null;
  image_url?: string | null;
  display_order?: number | null;
  oppgaver?: ReportOppgave[];
}

export interface ReportPunkt {
  id: string;
  punkt_nummer?: number;
  title?: string;
  description?: string | null;
  status?: string | null;
  fag?: string | null;
  prioritet?: string | null;
  created_at?: string | null;
  images?: ReportImage[];
}

export interface ReportBefaring {
  id: string;
  title: string;
  befaring_type?: string | null;
  befaring_date?: string | null;
  adresse?: string | null;
  postnummer?: string | null;
  sted?: string | null;
  status?: string | null;
  project_name?: string | null;
  tripletex_project_id?: number | null;
  performedBy?: string | null;
  dateFormatted?: string;
}

export type ReportType = 'standard' | 'fri_befaring';

export interface ReportStats {
  totalItems: number;
  openCount: number;
  inProgressCount: number;
  closedCount: number;
  criticalCount: number;
}

export interface BefaringReportData {
  type: ReportType;
  befaring: ReportBefaring;
  plantegninger?: ReportPlantegning[];
  befaringspunkter?: ReportPunkt[];
  stats: ReportStats;
}
