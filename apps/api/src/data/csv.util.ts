export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function parseCsvRecords(rawCsv: string): ParsedCsv {
  const text = rawCsv.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(unescapeCsvFormula(field.trim()));
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i += 1;
      }
      row.push(unescapeCsvFormula(field.trim()));
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        matrix.push(row);
      }
      row = [];
    } else if (ch === '\n') {
      row.push(unescapeCsvFormula(field.trim()));
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        matrix.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(unescapeCsvFormula(field.trim()));
    if (row.some((cell) => cell.length > 0)) {
      matrix.push(row);
    }
  }

  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = matrix[0];
  const rows = matrix.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = cells[idx] ?? '';
    });
    return obj;
  });

  return { headers, rows };
}

function unescapeCsvFormula(value: string): string {
  if (
    value.length > 1 &&
    value.startsWith("'") &&
    /^[=+\-@\t\r]/.test(value.slice(1))
  ) {
    return value.slice(1);
  }
  return value;
}
