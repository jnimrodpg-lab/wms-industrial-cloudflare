import { json } from '../_utils';
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i], n = text[i + 1];
    if (c === '"' && q && n === '"') { cur += '"'; i++; }
    else if (c === '"') q = !q;
    else if (c === ',' && !q) { row.push(cur); cur = ''; }
    else if ((c === '\n' || c === '\r') && !q) { if (cur || row.length) { row.push(cur); rows.push(row); break; } }
    else cur += c;
  }
  if (!rows.length && (cur || row.length)) { row.push(cur); rows.push(row); }
  return rows;
}
function toCsvUrl(url: string, sheetName?: string) {
  if (url.includes('gviz/tq')) return url;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); if (!m) return url;
  const base = `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}
export const onRequestPost: PagesFunction = async ({ request }) => {
  const { sheet_url, sheet_name } = await request.json() as any;
  const res = await fetch(toCsvUrl(sheet_url, sheet_name));
  if (!res.ok) return json({ error: 'No se pudo leer el Google Sheet.' }, { status: 400 });
  const rows = parseCsv(await res.text());
  return json({ headers: rows[0] || [] });
};
