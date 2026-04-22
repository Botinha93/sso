export interface ListPageQuery {
  page?: number;
  pageSize?: number;
}

const normalizePagination = (query?: ListPageQuery): { page: number; pageSize: number } => {
  const rawPage = Math.floor(query?.page ?? 1);
  const rawPageSize = Math.floor(query?.pageSize ?? 50);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : 50;

  return { page, pageSize };
};

export const applyTextFilter = <T>(
  items: T[],
  search: string | undefined,
  fields: Array<(item: T) => unknown>
): T[] => {
  const trimmed = search?.trim().toLowerCase();
  if (!trimmed) {
    return items;
  }

  return items.filter((item) =>
    fields.some((field) => String(field(item) ?? "").toLowerCase().includes(trimmed))
  );
};

export const applyPagination = <T>(items: T[], query?: ListPageQuery): T[] => {
  const { page, pageSize } = normalizePagination(query);
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};
