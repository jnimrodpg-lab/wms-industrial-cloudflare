import { json, uid } from './_utils';
export const onRequestGet: PagesFunction<{DB:D1Database}> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM branches ORDER BY created_at DESC').all();
  return json({ branches: results });
};
export const onRequestPost: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const b = await request.json() as any; const id = uid('branch');
  await env.DB.prepare('INSERT INTO branches (id,name,code,address,active) VALUES (?,?,?,?,1)').bind(id,b.name,b.code||'',b.address||'').run();
  return json({ id });
};
