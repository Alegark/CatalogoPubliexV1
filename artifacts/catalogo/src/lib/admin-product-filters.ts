export type AdminSearchableProduct = {
  name: string;
  slug: string;
  category: string;
  keywords?: readonly string[] | null;
};

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("es-VE");
}

export function filterAdminProducts<T extends AdminSearchableProduct>(
  products: readonly T[],
  search: string,
  category: string,
): T[] {
  const terms = normalizeText(search).split(/\s+/).filter(Boolean);
  const selectedCategory = normalizeText(category);

  return products.filter((product) => {
    if (selectedCategory && normalizeText(product.category) !== selectedCategory) return false;
    if (terms.length === 0) return true;

    const searchableText = normalizeText([
      product.name,
      product.slug,
      product.category,
      ...(product.keywords ?? []),
    ].join(" "));

    return terms.every((term) => searchableText.includes(term));
  });
}

export function countAdminProductsByCategory(
  products: readonly AdminSearchableProduct[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return counts;
}
