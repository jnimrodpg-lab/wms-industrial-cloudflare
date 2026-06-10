import { json } from './_utils';
export const onRequestGet: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const url = new URL(request.url); const q = `%${(url.searchParams.get('q')||'').toLowerCase()}%`; const branch = url.searchParams.get('branch_id');
  const sql = branch ?
    `SELECT * FROM products WHERE branch_id=? AND lower(coalesce(name,'')||' '||coalesce(sku,'')||' '||coalesce(barcode,'')||' '||coalesce(brand,'')||' '||coalesce(zone,'')||' '||coalesce(rack,'')) LIKE ? LIMIT 100` :
    `SELECT * FROM products WHERE lower(coalesce(name,'')||' '||coalesce(sku,'')||' '||coalesce(barcode,'')||' '||coalesce(brand,'')||' '||coalesce(zone,'')||' '||coalesce(rack,'')) LIKE ? LIMIT 100`;
  const stmt = branch ? env.DB.prepare(sql).bind(branch,q) : env.DB.prepare(sql).bind(q);
  const { results } = await stmt.all(); return json({ products: results });
};
