import { json } from '../../_utils';

// Fallback API para evitar error 404 si alguna vista llama:
// /api/branches/:id/products-summary
export const onRequestGet: PagesFunction<{DB:D1Database}> = async ({ params, env }) => {
  const branchId = String((params as any).id || '');
  const total = await env.DB.prepare('SELECT COUNT(*) AS total FROM products WHERE branch_id=?').bind(branchId).first<any>();
  const withoutImage = await env.DB.prepare("SELECT COUNT(*) AS total FROM products WHERE branch_id=? AND (image_url IS NULL OR image_url='')").bind(branchId).first<any>();
  const incomplete = await env.DB.prepare("SELECT COUNT(*) AS total FROM products WHERE branch_id=? AND ((zone IS NULL OR zone='') OR (rack IS NULL OR rack='') OR (level IS NULL OR level='') OR (slot IS NULL OR slot=''))").bind(branchId).first<any>();
  return json({
    branch_id: branchId,
    total: total?.total || 0,
    without_image: withoutImage?.total || 0,
    incomplete_location: incomplete?.total || 0
  });
};
