import { json, uid } from '../_utils';
export const onRequestGet: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const branch = new URL(request.url).searchParams.get('branch_id');
  const { results } = await env.DB.prepare('SELECT * FROM racks WHERE branch_id=?').bind(branch).all();
  return json({ racks: results });
};
export const onRequestPost: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const r = await request.json() as any; const id = uid('rack');
  await env.DB.prepare('INSERT INTO racks (id,branch_id,zone_id,name,type,levels,columns,slots,x,y,w,h,color) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,r.branch_id,r.zone_id||'',r.name,r.type||'simple',r.levels||4,r.columns||3,(r.levels||4)*(r.columns||3),r.x||120,r.y||180,r.w||120,r.h||42,r.color||'#334155').run();
  return json({ id });
};
