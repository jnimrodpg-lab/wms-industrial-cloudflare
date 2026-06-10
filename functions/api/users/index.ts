import { json, uid } from '../_utils';
export const onRequestGet: PagesFunction<{DB:D1Database}> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC').all();
  return json({ users: results });
};
export const onRequestPost: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const u = await request.json() as any; const id = uid('user');
  await env.DB.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').bind(id,u.name,u.email,u.password,u.role||'viewer').run();
  return json({ id });
};
