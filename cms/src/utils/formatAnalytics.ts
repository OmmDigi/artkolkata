/**
 * Number formatting for the dashboard, in one place so a rupee reads the same
 * on a card, in a tooltip and in a table.
 */

/** ₹12,345.00 — the full, exact figure. For tables and tooltips. */
export const formatMoney = (value: number) =>
  `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * ₹4.2L — for a stat tile, where the exact paise are noise and the width is
 * fixed. Indian grouping, so a lakh reads as a lakh and not as "420K".
 *
 * Only compacts from one lakh up: below that the full number is short enough
 * to print, and "₹6,500" is more useful to a shop owner than "₹6.5K".
 */
export const formatMoneyCompact = (value: number) => {
  const magnitude = Math.abs(value);

  if (magnitude < 100000) {
    return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }

  return `₹${value.toLocaleString("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
};

/**
 * An axis tick, with the notation chosen ONCE from the axis ceiling and then
 * applied to every tick on it.
 *
 * Deciding per value instead produces an axis reading ₹25,000 / ₹50,000 /
 * ₹75,000 / ₹1L, where the top tick silently changes units and the reader has
 * to notice. One axis, one notation.
 */
export const formatMoneyAxis = (value: number, ceiling: number) => {
  if (ceiling < 100000) {
    return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }

  return `₹${value.toLocaleString("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
};

/** 1,284 — counts, grouped, never compacted: they are small and exact matters. */
export const formatCount = (value: number) => value.toLocaleString("en-IN");

/**
 * A percentage the api may legitimately not have. Null means "no denominator",
 * which is not zero — see the refund rate in the api docs.
 */
export const formatPercent = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("en-IN")}%`;

/**
 * Axis and tooltip labels for a bucket timestamp.
 *
 * The api hands back IST wall clock with no offset ("2026-09-16T14:00"). That
 * is deliberate — it is already the local time the reader means — so it must
 * NOT be run through `new Date()` and re-localised, or a browser in another
 * timezone would shift every label off its data. The string is split instead.
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const splitBucket = (bucket: string) => {
  const [date, time = "00:00"] = bucket.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
};

export const formatBucketShort = (
  bucket: string,
  granularity: "hour" | "day" | "month",
) => {
  const { year, month, day, hour } = splitBucket(bucket);

  if (granularity === "hour") {
    const suffix = hour < 12 ? "am" : "pm";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return `${twelve}${suffix}`;
  }

  if (granularity === "month") return `${MONTHS[month - 1]} ${String(year).slice(2)}`;

  return `${day} ${MONTHS[month - 1]}`;
};

export const formatBucketLong = (
  bucket: string,
  granularity: "hour" | "day" | "month",
) => {
  const { year, month, day, hour } = splitBucket(bucket);

  if (granularity === "month") return `${MONTHS[month - 1]} ${year}`;

  const dayLabel = `${day} ${MONTHS[month - 1]} ${year}`;

  if (granularity === "hour") {
    const suffix = hour < 12 ? "am" : "pm";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return `${dayLabel}, ${twelve}:00${suffix}`;
  }

  return dayLabel;
};

/** "2026-09-16" from a Date, in local calendar terms — what the api wants */
export const toApiDate = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
