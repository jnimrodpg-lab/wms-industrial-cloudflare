import { json } from '../_utils';
export const onRequestPost: PagesFunction<{DB:D1Database}> = async ({ request, env }) => {
  const { email, password } = await request.json() as {email:string;password:string};
  const user = await env.DB.prepare('SELECT id,name,email,role FROM users WHERE email=? AND password=?').bind(email,password).first();
  if (!user) return json({ error: 'Credenciales incorrectas' }, { status: 401 });
  return json({ user });
};
