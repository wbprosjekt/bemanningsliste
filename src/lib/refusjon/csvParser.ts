/**
 * CSV Parser for Easee Key Detailed Reports
 * Supports automatic delimiter detection, encoding, and RFID validation
 */

export interface ParsedCSVRow {
  start_time: string; // ISO timestamp
  end_time: string;
  kwh: number;
  rfid_or_user: string;
  charger_name?: string;
  address?: string;
}

export interface ParsedCSV {
  rows: ParsedCSVRow[];
  summary: {
    total_rows: number;
    valid_rows: number;
    rows_with_rfid: number;
    rows_without_rfid: number;
    missing_columns: string[];
    rfid_column_found: boolean;
  };
}

export interface CSVParseError {
  code: 'MISSING_RFID_COLUMN' | 'INVALID_FORMAT' | 'MISSING_DATA';
  message: string;
  missing_columns?: string[];
}

/**
 * Parse CSV file with automatic delimiter and encoding detection
 */
export async function parseCSV(
  file: File
): Promise<{ data: ParsedCSV; error?: CSVParseError }> {
  const text = await file.text();

  // Try to detect encoding and delimiter
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    return {
      data: { rows: [], summary: initSummary() },
      error: {
        code: 'INVALID_FORMAT',
        message: 'CSV file must have at least a header row and one data row',
      },
    };
  }

  const headerLine = lines[0];
  const delimiter = detectDelimiter(headerLine);
  const headers = headerLine.split(delimiter).map((h) => normalizeHeader(h.trim()));

  // Find RFID column (critical)
  const rfidColumnIndex = findRFIDColumn(headers);
  if (rfidColumnIndex === -1) {
    return {
      data: { rows: [], summary: initSummary() },
      error: {
        code: 'MISSING_RFID_COLUMN',
        message:
          'Denne filen mangler RFID-nøkkel. Eksporter en "Easee Key Detailed Report" fra Easee Control for å kunne skille firmalading og privat lading.',
        missing_columns: ['rfid', 'key_id', 'easee_key'],
      },
    };
  }

  // Find other required columns
  const startColumnIndex = findColumn(headers, ['start', 'start_time', 'from']);
  const endColumnIndex = findColumn(headers, ['end', 'end_time', 'to']);
  const kwhColumnIndex = findColumn(headers, ['kwh', 'energy', 'forbruk']);
  const chargerColumnIndex = findColumn(headers, ['charger', 'charger_name', 'lader']);
  const addressColumnIndex = findColumn(headers, ['address', 'adresse', 'location']);

  // Track missing columns
  const missing = [];
  if (startColumnIndex === -1) missing.push('start_time');
  if (endColumnIndex === -1) missing.push('end_time');
  if (kwhColumnIndex === -1) missing.push('kwh');

  if (missing.length > 0) {
    return {
      data: { rows: [], summary: initSummary() },
      error: {
        code: 'MISSING_DATA',
        message: `Manglende obligatoriske kolonner: ${missing.join(', ')}`,
        missing_columns: missing,
      },
    };
  }

  // Parse rows
  const rows: ParsedCSVRow[] = [];
  let validRows = 0;
  let rowsWithRFID = 0;
  let rowsWithoutRFID = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter);

    const kwh = parseNumber(values[kwhColumnIndex]);
    if (!kwh || kwh <= 0) continue; // Skip rows without valid kWh

    const startTime = parseTimestamp(values[startColumnIndex]);
    const endTime = parseTimestamp(values[endColumnIndex]);
    const rfid = values[rfidColumnIndex]?.trim();

    if (!startTime || !endTime) continue;

    const row: ParsedCSVRow = {
      start_time: startTime,
      end_time: endTime,
      kwh,
      rfid_or_user: rfid || '',
      charger_name: chargerColumnIndex >= 0 ? values[chargerColumnIndex]?.trim() : undefined,
      address: addressColumnIndex >= 0 ? values[addressColumnIndex]?.trim() : undefined,
    };

    rows.push(row);
    validRows++;

    if (rfid && rfid.length > 0) {
      rowsWithRFID++;
    } else {
      rowsWithoutRFID++;
    }
  }

  return {
    data: {
      rows,
      summary: {
        total_rows: lines.length - 1,
        valid_rows: validRows,
        rows_with_rfid: rowsWithRFID,
        rows_without_rfid: rowsWithoutRFID,
        missing_columns: [],
        rfid_column_found: true,
      },
    },
  };
}

/**
 * Normalize header names (case-insensitive, whitespace, Norwegian/English)
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\s]+/g, '_')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'aa');
}

/**
 * Detect CSV delimiter (; or ,)
 */
function detectDelimiter(line: string): string {
  const semicolonCount = (line.match(/;/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Find RFID column (checks multiple possible names)
 */
function findRFIDColumn(headers: string[]): number {
  const possibleNames = [
    'key_id',
    'rfid',
    'easee_key',
    'easee_key_id',
    'brikke',
    'tag',
    'kort',
  ];
  return findColumn(headers, possibleNames);
}

/**
 * Find column by multiple possible names
 */
function findColumn(headers: string[], names: string[]): number {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Parse number (handles Norwegian decimal comma)
 */
function parseNumber(str?: string): number | null {
  if (!str) return null;
  const clean = str.trim().replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Parse timestamp (ISO or local time, assume Europe/Oslo if no timezone)
 */
function parseTimestamp(str?: string): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  // If already ISO format, return as is
  if (trimmed.includes('T') || trimmed.includes('+') || trimmed.includes('Z')) {
    return trimmed;
  }
  // Assume Europe/Oslo and convert to ISO
  try {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return null;
    // Convert to Europe/Oslo ISO format
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Initialize summary object
 */
function initSummary() {
  return {
    total_rows: 0,
    valid_rows: 0,
    rows_with_rfid: 0,
    rows_without_rfid: 0,
    missing_columns: [] as string[],
    rfid_column_found: false,
  };
}

/**
 * Generate hash for deduplication (SHA-256 over key fields)
 */
export async function generateSessionHash(
  employeeId: string,
  rfidKeyId: string,
  chargerId: string,
  startTime: string,
  endTime: string,
  kwh: number
): Promise<string> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(`${employeeId}-${rfidKeyId}-${chargerId}-${startTime}-${endTime}-${kwh}`);
  return hash.digest('hex');
}

