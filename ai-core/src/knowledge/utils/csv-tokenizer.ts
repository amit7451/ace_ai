/**
 * Minimal RFC4180-style CSV tokenizer: handles quoted fields, commas and
 * newlines inside quotes, and escaped quotes ("") within a quoted field.
 * Loads the whole input into memory rather than streaming — appropriate
 * for the knowledge-base-sized CSVs this platform ingests (FAQs, price
 * lists), not multi-gigabyte data exports. No new dependency (e.g.
 * papaparse) is introduced, consistent with Components 1-3's "native
 * fetch only, no vendor SDKs" posture — this is the parsing-layer
 * equivalent of that same zero-dependency choice.
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Flush a trailing field/row for files that don't end in a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-blank trailing rows produced by a trailing newline in the source file.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}
