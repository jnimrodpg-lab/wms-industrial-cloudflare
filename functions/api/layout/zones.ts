import { json, uid } from '../_utils';
export const onRequestGet: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const branch = new URL(request.url).searchParams.get('branch_id');
  const { results } = await env.DB.prepare('SELECT * FROM zones WHERE branch_id=?').bind(branch).all();
  return json({ zones: results });
};
export const onRequestPost: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const z = await request.json() as any; const id = uid('zone');
  await env.DB.prepare('INSERT INTO zones (id,branch_id,name,x,y,w,h,color) VALUES (?,?,?,?,?,?,?,?)').bind(id,z.branch_id,z.name,z.x||60,z.y||70,z.w||220,z.h||140,z.color||'#dbeafe').run();
  return json({ id });
};
