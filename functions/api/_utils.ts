export interface Env { DB: D1Database }
export const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json;charset=UTF-8', ...(init.headers || {}) } });
export const uid = (prefix='id') => `${prefix}_${crypto.randomUUID().slice(0,8)}`;
export async function body<T>(request: Request): Promise<T> { return await request.json() as T; }
