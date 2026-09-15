export const MAX_PRODUCT_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 60;

function keywordKey(value: string): string {
  return value.toLocaleLowerCase("es-VE");
}

export function normalizeProductKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const keyword of value) {
    if (typeof keyword !== "string") continue;
    const trimmed = keyword.trim();
    if (!trimmed || trimmed.length > MAX_KEYWORD_LENGTH) continue;

    const key = keywordKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);

    if (normalized.length >= MAX_PRODUCT_KEYWORDS) break;
  }

  return normalized;
}

export function collectProductKeywords(values: unknown[], search = ""): string[] {
  const normalizedSearch = search.trim().toLocaleLowerCase("es-VE");
  const unique = new Map<string, string>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    const keyword = value.trim();
    if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) continue;

    const key = keywordKey(keyword);
    if (normalizedSearch && !key.includes(normalizedSearch)) continue;
    if (!unique.has(key)) unique.set(key, keyword);
  }

  return [...unique.values()].sort((a, b) => a.localeCompare(b, "es-VE", { sensitivity: "base" }));
}

export function removeProductKeyword(value: unknown, target: string): string[] {
  const targetKey = keywordKey(target.trim());
  return normalizeProductKeywords(value).filter((keyword) => keywordKey(keyword) !== targetKey);
}
