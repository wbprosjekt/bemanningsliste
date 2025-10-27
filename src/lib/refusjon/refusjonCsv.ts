/**
 * CSV Export for Reimbursement Reports
 * Includes metadata and pricing breakdown per hour
 */

export interface ReimbursementCSVRow {
  date_hour: string; // YYYY-MM-DD HH:00
  rfid: string;
  kwh_bit: number;
  energy_price_nok: number;
  nett_price_nok: number;
  support_nok: number;
  total_nok: number;
  ordning: 'norgespris' | 'spot_med_stromstotte';
  area: string;
  notes?: string;
}

export function generateCSVContent(rows: ReimbursementCSVRow[]): string {
  // CSV header
  const header = [
    'date_hour',
    'rfid',
    'kwh_bit',
    'energy_price_nok',
    'nett_price_nok',
    'support_nok',
    'total_nok',
    'ordning',
    'area',
    'notes',
  ].join(',');

  // CSV rows
  const csvRows = rows.map((row) => {
    return [
      `"${row.date_hour}"`,
      `"${row.rfid}"`,
      row.kwh_bit.toFixed(3),
      row.energy_price_nok.toFixed(6),
      row.nett_price_nok.toFixed(6),
      row.support_nok.toFixed(6),
      row.total_nok.toFixed(2),
      `"${row.ordning}"`,
      `"${row.area}"`,
      row.notes ? `"${row.notes}"` : '',
    ].join(',');
  });

  return [header, ...csvRows].join('\n');
}

export function createDownloadableBlob(csvContent: string): Blob {
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = createDownloadableBlob(csvContent);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

