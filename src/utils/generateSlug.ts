import slugify from "slug";
import { Product } from "../models/Product.ts";

export async function generateProductSlug(
  name: string,
  variables?: { name: string; values: string[] }[],
  excludeId?: string
): Promise<string> {
  let slugBase = name;

  if (variables?.length) {
    const parts: string[] = [];

    variables.forEach((v) => {
      if (Array.isArray(v.values) && v.values.length) {
        parts.push(...v.values);
      }
    });

    if (parts.length) {
      slugBase = `${name} ${parts.join(" ")}`;
    }
  }

  let slug = slugify(slugBase, { lower: true });
  let count = 1;

  while (
    await Product.exists({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    slug = `${slug}-${count++}`;
  }

  return slug;
}
