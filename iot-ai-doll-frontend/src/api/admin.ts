/**
 * 管理后台通用 CRUD API
 */
import client from './client';
import type { InsertPayload, UpdatePayload, DeletePayload } from '../types';

/** 通用查询（query params） */
export function adminQuery<T = unknown>(params: {
  table: string;
  filter_xxx?: Record<string, string>;
  order?: string;
  limit?: number;
}) {
  // 把 filter_xxx 展平为 filter_key=value 格式
  const searchParams = new URLSearchParams();
  searchParams.set('table', params.table);
  if (params.order) searchParams.set('order', params.order);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.filter_xxx) {
    for (const [k, v] of Object.entries(params.filter_xxx)) {
      searchParams.set(`filter_${k}`, v);
    }
  }
  return client.get<T[]>(`/admin/query?${searchParams.toString()}`);
}

/** 通用插入 */
export function adminInsert(payload: InsertPayload) {
  return client.post('/admin/insert', payload);
}

/** 通用更新 */
export function adminUpdate(payload: UpdatePayload) {
  return client.post('/admin/update', payload);
}

/** 通用删除 */
export function adminDelete(payload: DeletePayload) {
  return client.post('/admin/delete', payload);
}
