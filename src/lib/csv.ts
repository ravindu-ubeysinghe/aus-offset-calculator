/**
 * A small RFC 4180 CSV reader/writer.
 *
 * Profiles round-trip through spreadsheet apps, so quoting has to be handled
 * properly rather than by splitting on commas — a profile name containing a
 * comma would otherwise shift every column after it.
 */

export type CsvRow = string[];

/** Parse CSV text into rows. Tolerates CRLF and a leading BOM (Excel writes one). */
export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: CsvRow[] = [];
  let row: CsvRow = [];
  let field = '';
  let inQuotes = false;
  let started = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      started = true;
    } else if (char === ',') {
      endField();
      started = true;
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      field += char;
      started = true;
    }
  }

  // A trailing newline should not produce a final empty row.
  if (started || field !== '' || row.length > 0) endRow();

  return rows;
}

/** Serialise rows to CSV text, quoting only the fields that need it. */
export function toCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '');
          return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\n');
}

/** Drop rows that are entirely blank — spreadsheet exports are full of them. */
export function withoutBlankRows(rows: CsvRow[]): CsvRow[] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}
