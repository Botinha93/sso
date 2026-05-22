export interface AdminListQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

export const parseAdminListQuery = (query: Record<string, unknown>): AdminListQuery => {
  const searchRaw = query.search ?? query.q;
  const search = typeof searchRaw === "string" && searchRaw.trim() ? searchRaw.trim() : undefined;

  const pageRaw = Number(query.page);
  const pageSizeRaw = Number(query.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : undefined;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : undefined;

  return { search, page, pageSize };
};

export const applyListSearch = <T>(
  items: T[],
  search: string | undefined,
  fields: Array<(item: T) => unknown>
): T[] => {
  const needle = search?.trim().toLowerCase();
  if (!needle) {
    return items;
  }

  return items.filter((item) =>
    fields.some((field) => String(field(item) ?? "").toLowerCase().includes(needle))
  );
};

export const applyListPagination = <T>(items: T[], query: AdminListQuery): T[] => {
  if (!query.page && !query.pageSize) {
    return items;
  }

  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 50;
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

export const filterAdminList = <T>(
  items: T[],
  query: Record<string, unknown>,
  fields: Array<(item: T) => unknown>
): T[] => {
  const parsed = parseAdminListQuery(query);
  const filtered = applyListSearch(items, parsed.search, fields);
  return applyListPagination(filtered, parsed);
};
