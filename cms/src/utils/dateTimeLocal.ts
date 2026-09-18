/**
 * <input type="datetime-local"> speaks wall clock time with no zone, the api
 * speaks absolute instants. These two convert between them using the browser's
 * own timezone, so an admin in IST picks 9 AM and the post goes live at 9 AM
 * IST regardless of where the api runs.
 */

/** ISO instant from the api -> "YYYY-MM-DDTHH:mm" for the input */
export const toDateTimeLocal = (iso: string | null | undefined) => {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** "YYYY-MM-DDTHH:mm" from the input -> ISO instant for the api */
export const toIsoInstant = (value: string) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
};
