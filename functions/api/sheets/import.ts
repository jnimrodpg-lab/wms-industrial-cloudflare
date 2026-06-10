import { json, uid } from '../_utils';
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i], n = text[i + 1];
    if (c === '"' && q && n === '"') { cur += '"'; i++; }
    else if (c === '"') q = !q;
    else if (c === ',' && !q) { row.push(cur); cur = ''; }
    else if ((c === '\n' || c === '\r') && !q) { if (cur || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; } if (c === '\r' && n === '\n') i++; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const DEFAULT_MAP: Record<string,string> = {gender:'__idx:0',category:'__idx:1',status:'__idx:2',brand:'__idx:3',model:'__idx:4',thickness:'__idx:5',size:'__idx:6',color:'__idx:7',line:'__idx:8',barcode:'__idx:9',sku:'__idx:10',name:'__idx:11',variant:'__idx:12',zone:'__idx:13',rack:'__idx:14',level:'__idx:15',slot:'__idx:16',location:'__idx:17',secondaryZone:'__idx:18',secondaryRack:'__idx:19',secondaryLevel:'__idx:20',secondarySlot:'__idx:21',warehouse:'__idx:22',price:'__idx:23',stock:'__idx:24',restock:'__idx:24'};
function rawWithIndexedHeaders(headers: string[], row: string[]) {
  const raw: Record<string,string> = {};
  headers.forEach((h, i) => {
    const key = (h || `Columna ${i+1}`).trim() || `Columna ${i+1}`;
    raw[`C${i+1} ${key}`] = row[i] || '';
    if (raw[key] === undefined) raw[key] = row[i] || '';
    else raw[`${key} (${i+1})`] = row[i] || '';
  });
  return raw;
}
function getMapped(row: string[], raw: Record<string,string>, mapping: Record<string,string>, field: string) {
  const mapValue = mapping[field] || DEFAULT_MAP[field] || '';
  if (mapValue.startsWith('__idx:')) return (row[Number(mapValue.replace('__idx:',''))] || '').trim();
  return (raw[mapValue] || '').trim();
}

function toCsvUrl(url: string, sheetName?: string) {
  if (url.includes('gviz/tq')) return url;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); if (!m) return url;
  const base = `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}
export const onRequestPost: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const { branch_id, sheet_url, sheet_name, mapping } = await request.json() as any;
  const res = await fetch(toCsvUrl(sheet_url, sheet_name));
  if (!res.ok) return json({ error: 'No se pudo leer el Google Sheet.' }, { status: 400 });
  const rows = parseCsv(await res.text()); const headers = rows[0] || [];
  await env.DB.prepare('UPDATE branches SET sheet_url=?, sheet_name=? WHERE id=?').bind(sheet_url, sheet_name || '', branch_id).run();
  await env.DB.prepare('INSERT OR REPLACE INTO column_mappings (branch_id,mapping_json,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)').bind(branch_id, JSON.stringify(mapping || {})).run();
  await env.DB.prepare('DELETE FROM products WHERE branch_id=?').bind(branch_id).run();
  let count = 0;
  let skipped_without_name = 0;
  const effectiveMapping = { ...DEFAULT_MAP, ...(mapping || {}) };
  for (const r of rows.slice(1)) {
    if (!r.some(Boolean)) continue;
    const raw = rawWithIndexedHeaders(headers, r);
    const get = (f: string) => getMapped(r, raw, effectiveMapping, f);
    const productName = get('name');
    if (!productName) { skipped_without_name++; continue; }
    const zone = get('zone') || get('secondaryZone');
    const rack = get('rack') || get('secondaryRack');
    const level = get('level') || get('secondaryLevel');
    const slot = get('slot') || get('secondarySlot');
    await env.DB.prepare(`INSERT INTO products (id,branch_id,sku,barcode,name,brand,category,image_url,stock,zone,rack,level,slot,warehouse,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid('prod'), branch_id, get('sku'), get('barcode'), productName, get('brand'), get('category'), get('imageUrl'), get('stock') || get('restock'), zone, rack, level, slot, get('warehouse'), JSON.stringify(raw)).run();
    count++;
  }
  return json({ imported: count, skipped_without_name, headers });
};
