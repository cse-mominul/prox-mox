export interface PageQuery { page?: number; limit?: number; search?: string; sort?: string; }
export function pageArgs(q: PageQuery) {
  const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}
