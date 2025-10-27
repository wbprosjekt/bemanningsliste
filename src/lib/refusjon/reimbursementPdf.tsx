/**
 * PDF Report Generator for Reimbursement
 * Uses @react-pdf/renderer
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Define types matching the contract
export interface ReimbursementPdfProps {
  orgName: string;
  logoUrl?: string;
  reportTitle?: string;
  periodLabel: string;
  employeeName: string;
  employeeEmail: string;
  rfidLabel: string;
  chargerAddress?: string;
  priceArea: 'NO1' | 'NO2' | 'NO3' | 'NO4' | 'NO5';
  policyLabel: string;
  nettProfileLabel: string;
  generatedAtISO: string;
  sourceCsvSha256: string;
  summary: {
    monthLabel: string;
    totalKwh: number;
    avgNokPerKwh: number;
    energyAmountNok: number;
    effectChargeNok: number;
    totalRefundNok: number;
  };
  details: Array<{
    date: string;
    start: string;
    end: string;
    duration: string;
    kwh: number;
    price: {
      spotInclNokPerKwh?: number;
      nettInclNokPerKwh?: number;
      supportNokPerKwh?: number;
      effectiveEnergyNokPerKwh: number;
      amountNok: number;
    };
  }>;
  notes?: string[];
  missingHoursNote?: string;
}

// Helper functions
const formatNOK = (n: number) =>
  n.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatKWH = (n: number) =>
  n.toLocaleString('nb-NO', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

const formatPrice = (n?: number) =>
  n == null ? '–' : formatNOK(n).replace(' kr', '') + ' kr/kWh';

// Styles (React-PDF compatible, no CSS shortcuts)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: '#111',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  col: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    borderBottomStyle: 'solid',
  },
  cell: {
    flex: 1,
    padding: 4,
  },
  cellRight: {
    flex: 1,
    padding: 4,
    textAlign: 'right',
  },
  footer: {
    marginTop: 16,
    fontSize: 9,
    color: '#666',
  },
});

export const ReimbursementPdf: React.FC<ReimbursementPdfProps> = (props) => {
  const {
    orgName,
    reportTitle = 'Refusjonsrapport for hjemmelading',
    periodLabel,
    employeeName,
    employeeEmail,
    rfidLabel,
    chargerAddress,
    priceArea,
    policyLabel,
    nettProfileLabel,
    generatedAtISO,
    sourceCsvSha256,
    summary,
    details,
    notes = [],
    missingHoursNote,
  } = props;

  return (
    <Document title={`${orgName} – Refusjon ${periodLabel}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{reportTitle}</Text>
          <Text style={styles.subtitle}>{orgName}</Text>
          <Text style={styles.subtitle}>Periode: {periodLabel}</Text>
        </View>

        {/* Meta Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasjon</Text>
          <View style={{ marginLeft: 8 }}>
            <Text style={{ marginBottom: 4 }}>Ansatt: {employeeName}</Text>
            <Text style={{ marginBottom: 4 }}>E-post: {employeeEmail}</Text>
            <Text style={{ marginBottom: 4 }}>RFID: {rfidLabel}</Text>
            {chargerAddress && (
              <Text style={{ marginBottom: 4 }}>Ladepunkt: {chargerAddress}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prisgrunnlag</Text>
          <View style={{ marginLeft: 8 }}>
            <Text style={{ marginBottom: 4 }}>Prisområde: {priceArea}</Text>
            <Text style={{ marginBottom: 4 }}>Ordning: {policyLabel}</Text>
            <Text style={{ marginBottom: 4 }}>Nettleie: {nettProfileLabel}</Text>
            <Text style={{ marginBottom: 4 }}>Generert: {new Date(generatedAtISO).toLocaleString('nb-NO')}</Text>
            <Text style={{ marginBottom: 4 }}>CSV hash: {sourceCsvSha256.substring(0, 10)}…</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sammendrag</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.cell, width: 120 }}>Måned</Text>
            <Text style={{ ...styles.cellRight, width: 80 }}>Totalt kWh</Text>
            <Text style={{ ...styles.cellRight, width: 140 }}>Snittpris</Text>
            <Text style={{ ...styles.cellRight, width: 100 }}>Beløp</Text>
            <Text style={{ ...styles.cellRight, width: 100 }}>Total</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={{ ...styles.cell, width: 120 }}>{summary.monthLabel}</Text>
            <Text style={{ ...styles.cellRight, width: 80 }}>{formatKWH(summary.totalKwh)}</Text>
            <Text style={{ ...styles.cellRight, width: 140 }}>{formatPrice(summary.avgNokPerKwh)}</Text>
            <Text style={{ ...styles.cellRight, width: 100 }}>{formatNOK(summary.energyAmountNok)}</Text>
            <Text style={{ ...styles.cellRight, width: 100, fontWeight: 'bold' }}>
              {formatNOK(summary.totalRefundNok)}
            </Text>
          </View>
        </View>

        {/* Details per session */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detaljer per ladeøkt</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>Dato</Text>
            <Text style={styles.cell}>Start-Slutt</Text>
            <Text style={styles.cellRight}>kWh</Text>
            <Text style={styles.cellRight}>Beløp</Text>
          </View>
          {details.slice(0, 10).map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{row.date}</Text>
              <Text style={styles.cell}>{row.start}–{row.end}</Text>
              <Text style={styles.cellRight}>{formatKWH(row.kwh)}</Text>
              <Text style={styles.cellRight}>{formatNOK(row.price.amountNok)}</Text>
            </View>
          ))}
          {details.length > 10 && (
            <Text style={{ marginTop: 8, fontSize: 8 }}>... og {details.length - 10} flere økter</Text>
          )}
        </View>

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prisgrunnlag og metadata</Text>
          <View style={{ marginLeft: 8 }}>
            <Text>Spotpris: Hva Koster Strømmen (uten API-nøkkel).</Text>
            <Text>Nettleie (TOU): {nettProfileLabel}. Alle priser inkl. mva.</Text>
            <Text>Strømstøtte: 90% over 0,75 kr/kWh eks. mva.</Text>
            {missingHoursNote && (
              <Text style={{ color: '#dc2626' }}>Merknad: {missingHoursNote}</Text>
            )}
            {notes.map((note, i) => (
              <Text key={i} style={{ marginTop: 2 }}>• {note}</Text>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>FieldNote.no – Refusjon hjemmelading • Dokument generert automatisk.</Text>
        </View>
      </Page>
    </Document>
  );
};

// Helper to render to buffer
import { renderToBuffer } from '@react-pdf/renderer';

export async function buildReimbursementPdfBuffer(
  props: ReimbursementPdfProps
): Promise<Buffer> {
  const doc = <ReimbursementPdf {...props} />;
  const buf = await renderToBuffer(doc);
  return Buffer.from(buf);
}

