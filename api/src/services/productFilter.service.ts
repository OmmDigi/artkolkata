import { CustomRequest } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import { isNumber } from "../utils/isNumber";

/**
 * Lateral join that exposes the cheapest / costliest variant price of a product.
 * The alias `vp` is what MIN_PRICE_EXPR and MAX_PRICE_EXPR read from, so any query
 * using those expressions has to include this join right after `FROM products p`.
 */
export const PRODUCT_PRICE_JOIN = `
    LEFT JOIN LATERAL (
      SELECT MIN(pv.price) AS min_price, MAX(pv.price) AS max_price
      FROM product_variants pv
      WHERE pv.product_id = p.id
    ) vp ON TRUE
`;

// a product without variants sells at its own price, otherwise the variants decide the range
export const MIN_PRICE_EXPR = "COALESCE(vp.min_price, p.price)";
export const MAX_PRICE_EXPR = "COALESCE(vp.max_price, p.price)";

export interface IProductFilter {
  where: string;
  values: any[];
}

export type ProductFilterKey =
  | "category"
  | "sub_category"
  | "tag"
  | "search"
  | "price"
  | "option"
  | "status";

const toArray = (value: any): string[] => {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((item) => item.toString().split(","))
    .map((item: string) => item.trim())
    .filter((item: string) => item !== "");
};

/**
 * Every option filter arrives as `option=Name:Value` (repeatable). Values of the same
 * option name are OR'ed together, different option names are AND'ed:
 * `?option=Color:Red&option=Color:Blue&option=Size:M` -> (Red OR Blue) AND (M)
 */
const parseOptionFilters = (value: any): Map<string, string[]> => {
  const grouped = new Map<string, string[]>();

  toArray(value).forEach((pair) => {
    const separatorIndex = pair.indexOf(":");
    if (separatorIndex === -1) return;

    const name = pair.slice(0, separatorIndex).trim().toLowerCase();
    const optionValue = pair.slice(separatorIndex + 1).trim().toLowerCase();
    if (name === "" || optionValue === "") return;

    grouped.set(name, [...(grouped.get(name) ?? []), optionValue]);
  });

  return grouped;
};

export type ProductSearchScope = "name" | "tag" | "both";

/** must match the regconfig products.search_vector is generated with */
const SEARCH_CONFIG = "english";

/**
 * products.search_vector holds the product name (weight A) and its tag names
 * (weight B), maintained by the database as a generated column.
 */
const PRODUCT_SEARCH_VECTOR = "p.search_vector";

/**
 * `search` looks at the product name and its tag names by default, so a shopper
 * typing "featured" finds the products carrying that tag as well as the ones
 * named after it. `search_by=name` or `search_by=tag` narrows it to one side;
 * anything unrecognised falls back to searching both.
 */
const parseSearchScope = (value: any): ProductSearchScope => {
  const scope = value?.toString().trim().toLowerCase();
  return scope === "name" || scope === "tag" ? scope : "both";
};

/**
 * Turns what the shopper typed into a tsquery.
 *
 * Every token gets a `:*` so the search still works while they are still
 * typing — "clean" finds "Cleanser" — and tokens are AND'ed, so each extra
 * word narrows the result the way a search box is expected to behave.
 *
 * Stripping everything that is not a letter, digit or space is also what makes
 * the string safe to hand to to_tsquery: the tsquery operators (`&` `|` `!`
 * `:` `*` `(` `)`) cannot survive it, so a term like `a:* | b` becomes two
 * plain words instead of a query the shopper wrote themselves.
 *
 * Returns null when nothing searchable is left.
 */
const toPrefixTsQuery = (value: any): string | null => {
  const tokens = (value ?? "")
    .toString()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((token: string) => token !== "");

  if (tokens.length === 0) return null;

  return tokens.map((token: string) => `${token}:*`).join(" & ");
};

/**
 * Builds the WHERE clause shared by the product list and the product filter (facet)
 * endpoints, so both always look at exactly the same set of products.
 *
 * Supported query params:
 *  category, sub_category  - id or slug, repeatable / comma separated
 *  tag                     - repeatable / comma separated, matches any of them
 *  search                  - full text match on the product name or any of its tag names
 *  search_by               - `name` | `tag` | `both` (default), narrows what `search` looks at
 *  min_price, max_price    - overlap match against the product's effective price range
 *  option                  - `Name:Value`, repeatable / comma separated
 *  status                  - admin only, otherwise only public (status = 1) products
 *
 * `skip` drops the listed filters from the clause. The facet endpoint uses it to count
 * a dimension without the dimension's own selection narrowing it away, which is what
 * keeps a multi select filter (two colours, three tags) usable.
 */
export const buildProductFilter = (
  req: CustomRequest,
  skip: ProductFilterKey[] = [],
): IProductFilter => {
  const query = req.query;
  const skipped = new Set(skip);
  const values: any[] = [];
  let filter = "WHERE 1=1";
  const nextPlaceholder = (value: any) => {
    values.push(value);
    return `$${values.length}`;
  };

  const categories = skipped.has("category") ? [] : toArray(query.category);
  if (categories.length > 0) {
    // a slug list and an id list are never mixed, the first entry decides the column
    const key = isNumber(categories[0]) ? "p.category_id" : "c.slug";
    const placeholders = categories.map((item) => nextPlaceholder(item)).join(", ");
    filter += ` AND ${key} IN (${placeholders})`;
  }

  const subCategories = skipped.has("sub_category")
    ? []
    : toArray(query.sub_category);
  if (subCategories.length > 0) {
    const key = isNumber(subCategories[0]) ? "sc.id" : "sc.slug";
    const placeholders = subCategories
      .map((item) => nextPlaceholder(item))
      .join(", ");
    filter += ` AND ${key} IN (${placeholders})`;
  }

  const tags = skipped.has("tag") ? [] : toArray(query.tag);
  if (tags.length > 0) {
    // tags is a jsonb object {"tag": true}, `?|` matches when any of the keys exists
    filter += ` AND p.tags ?| ${nextPlaceholder(tags)}`;
  }

  if (query.search && !skipped.has("search")) {
    const tsQuery = toPrefixTsQuery(query.search);

    if (tsQuery === null) {
      // the term was punctuation only, so there is no word left to match on.
      // An empty tsquery matches nothing in Postgres; say so explicitly rather
      // than dropping the filter and handing back the whole catalogue.
      filter += " AND FALSE";
    } else {
      const scope = parseSearchScope(query.search_by);
      // 'a' is the product name, 'b' a tag name — the weights the generated
      // column stores. Narrowing by weight costs the index (ts_filter is
      // computed per row), which is why the default searches the whole vector.
      const vector =
        scope === "name"
          ? `ts_filter(${PRODUCT_SEARCH_VECTOR}, '{a}')`
          : scope === "tag"
            ? `ts_filter(${PRODUCT_SEARCH_VECTOR}, '{b}')`
            : PRODUCT_SEARCH_VECTOR;

      filter += ` AND ${vector} @@ to_tsquery('${SEARCH_CONFIG}', ${nextPlaceholder(tsQuery)})`;
    }
  }

  // a product matches when any part of its price range overlaps the requested range
  const skipPrice = skipped.has("price");
  if (!skipPrice && query.min_price !== undefined && isNumber(query.min_price)) {
    filter += ` AND ${MAX_PRICE_EXPR} >= ${nextPlaceholder(query.min_price)}`;
  }

  if (!skipPrice && query.max_price !== undefined && isNumber(query.max_price)) {
    filter += ` AND ${MIN_PRICE_EXPR} <= ${nextPlaceholder(query.max_price)}`;
  }

  const optionFilters = skipped.has("option")
    ? new Map<string, string[]>()
    : parseOptionFilters(query.option);
  optionFilters.forEach((optionValues, optionName) => {
    filter += ` AND EXISTS (
      SELECT 1
      FROM product_options fpo
      JOIN product_option_values fpov ON fpov.option_id = fpo.id
      WHERE fpo.product_id = p.id
        AND LOWER(fpo.name) = ${nextPlaceholder(optionName)}
        AND LOWER(fpov.value) = ANY(${nextPlaceholder(optionValues)})
    )`;
  });

  if (query.status && checkPermission(req.token_info?.permissions ?? null, ["1-6"])) {
    // admins may ask for any status, everyone else is pinned to the public products
    filter += ` AND p.status = ${nextPlaceholder(query.status)}`;
  } else if (!checkPermission(req.token_info?.permissions ?? null, ["1-3"])) {
    filter += " AND p.status = 1";
  }

  return { where: filter, values };
};

/**
 * Builds the ORDER BY clause of the product list.
 *
 * `sort=price_asc`  - cheapest first, compared on the product's lowest price
 * `sort=price_desc` - costliest first, compared on the product's highest price
 *
 * Anything else keeps the default merchandising order. The value is matched against a
 * whitelist, so it is never interpolated into the query.
 */
export const buildProductSort = (req: CustomRequest): string => {
  const DEFAULT_SORT = "ORDER BY p.position ASC, p.id DESC";
  const sort = req.query.sort?.toString().trim().toLowerCase();

  switch (sort) {
    case "price_asc":
    case "price_low_to_high":
      return `ORDER BY ${MIN_PRICE_EXPR} ASC, p.id DESC`;
    case "price_desc":
    case "price_high_to_low":
      return `ORDER BY ${MAX_PRICE_EXPR} DESC, p.id DESC`;
    default:
      return DEFAULT_SORT;
  }
};
