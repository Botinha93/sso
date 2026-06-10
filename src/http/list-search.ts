export interface AdminListQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  group?: string;
  active?: boolean;
  customAttributes?: Record<string, string>;
}

const CUSTOM_ATTRIBUTE_QUERY_PREFIX = "customAttribute.";

export const parseCustomAttributeFilters = (
  query: Record<string, unknown>
): Record<string, string> => {
  const filters: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(query)) {
    if (!key.startsWith(CUSTOM_ATTRIBUTE_QUERY_PREFIX)) {
      continue;
    }
    const attributeKey = key.slice(CUSTOM_ATTRIBUTE_QUERY_PREFIX.length).trim();
    if (!attributeKey || rawValue === undefined || rawValue === null) {
      continue;
    }
    filters[attributeKey] = String(rawValue);
  }
  return filters;
};

export const parseAdminListQuery = (query: Record<string, unknown>): AdminListQuery => {
  const searchRaw = query.search ?? query.q;
  const search = typeof searchRaw === "string" && searchRaw.trim() ? searchRaw.trim() : undefined;

  const pageRaw = Number(query.page);
  const pageSizeRaw = Number(query.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : undefined;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : undefined;

  const groupRaw = query.group;
  const group = typeof groupRaw === "string" && groupRaw.trim() ? groupRaw.trim() : undefined;

  let active: boolean | undefined;
  if (query.active === "true" || query.active === true) {
    active = true;
  } else if (query.active === "false" || query.active === false) {
    active = false;
  }

  const customAttributes = parseCustomAttributeFilters(query);

  return { search, page, pageSize, group, active, customAttributes };
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
