// The line a receipt carries under the figure, spelled the Indian way —
// crore, lakh, thousand — because that is how the amount is read here and how
// an accountant expects to find it written.
//
// Words are what makes a receipt hard to alter: a digit can be changed with a
// pen, a sentence cannot.

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

/** 0-99, the only range the rest of the file ever has to spell out directly. */
const twoDigits = (value: number): string => {
  if (value < 20) return ONES[value];
  const tens = TENS[Math.floor(value / 10)];
  const ones = ONES[value % 10];
  return ones ? `${tens} ${ones}` : tens;
};

/** 0-999 — one "hundred" group, which every Indian unit above is built from. */
const threeDigits = (value: number): string => {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;

  return [
    hundreds ? `${ONES[hundreds]} Hundred` : "",
    rest ? twoDigits(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
};

/**
 * A whole number of rupees in words, without the currency itself.
 *
 * Indian grouping: the top group is crores, then lakhs, then thousands, then
 * the last three digits. Anything at or above a hundred crore keeps counting in
 * crores ("One Thousand Two Hundred Crore"), which is what the convention does
 * and what keeps an absurd order total readable rather than wrong.
 */
const wholeNumberInWords = (value: number): string => {
  if (value === 0) return "Zero";

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;

  return [
    crore ? `${wholeNumberInWords(crore)} Crore` : "",
    lakh ? `${threeDigits(lakh)} Lakh` : "",
    thousand ? `${threeDigits(thousand)} Thousand` : "",
    rest ? threeDigits(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
};

/**
 * `19500` -> `Rupees Nineteen Thousand Five Hundred Only`
 * `1250.5` -> `Rupees One Thousand Two Hundred Fifty and Fifty Paise Only`
 *
 * Paise are named only when there are any, the way a receipt is written by
 * hand. A negative amount cannot be received, so the sign is dropped rather
 * than spelled — a refund is a different document.
 */
export const amountInWords = (amount: number): string => {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;

  // Rounded to paise first, so 0.999 reads as one rupee instead of losing the
  // rounding that the printed figure already did.
  const paise = Math.round(safe * 100);
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;

  return [
    "Rupees",
    wholeNumberInWords(rupees),
    fraction ? `and ${twoDigits(fraction)} Paise` : "",
    "Only",
  ]
    .filter(Boolean)
    .join(" ");
};
