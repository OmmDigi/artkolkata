import { ErrorHandler } from "./ErrorHandler";
import { REPORTING_TIMEZONE } from "../constant";

/**
 * A dashboard is read by someone sitting in India: "Today" has to mean the
 * Indian calendar day, not the UTC one, or every order placed after 5:30am IST
 * lands in the wrong bucket. So a window boundary is worked out here as the
 * absolute instant at which the clock in REPORTING_TIMEZONE reads midnight.
 *
 * That instant leaves as an ISO string with an offset, which postgres parses
 * as timestamptz. The queries convert it into the database's own clock —
 * `AT TIME ZONE current_setting('TimeZone')` — because the columns being
 * compared are bare TIMESTAMPs holding that clock and nothing else. Asking
 * postgres what its zone is, rather than hardcoding one, is what keeps the
 * numbers identical on a UTC container and on a developer's IST postgres.
 *
 * The comparison itself stays a plain `created_at >= $1 AND created_at < $2`
 * against two constants, so it is one range scan on idx_orders_created_at and
 * not a per-row conversion that no index could serve.
 */

export type TRangeBucket = "hour" | "day" | "month";

export type TRangePreset = "today" | "7d" | "30d" | "3m" | "1y" | "custom";

export interface IResolvedRange {
  /** the preset the caller asked for */
  preset: TRangePreset;
  /** inclusive lower bound as an absolute instant (ISO 8601), for the SQL WHERE */
  startAt: string;
  /** EXCLUSIVE upper bound as an absolute instant (ISO 8601) */
  endAt: string;
  /** the same two bounds as reporting-timezone wall clock, for generate_series */
  startAtLocal: string;
  endAtLocal: string;
  /** how a chart over this window should be bucketed */
  bucket: TRangeBucket;
  /** reporting timezone, echoed back so a client knows what it is reading */
  timezone: string;
  /** human label for the window, e.g. "Last 30 days" */
  label: string;
}

const PRESET_LABELS: Record<TRangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "3m": "Last 3 months",
  "1y": "Last 1 year",
  custom: "Custom range",
};

interface IWallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * The wall clock an instant shows in a given zone. Intl is used rather than a
 * hardcoded +05:30 so that changing REPORTING_TIMEZONE to a zone that observes
 * daylight saving still produces correct day boundaries.
 */
const wallClockIn = (instant: Date, timeZone: string): IWallClock => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) =>
    parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl renders midnight as hour 24 in some locales/versions
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
};

const offsetMsAt = (instant: Date, timeZone: string) => {
  const wall = wallClockIn(instant, timeZone);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  return asIfUtc - instant.getTime();
};

/**
 * The instant at which the given zone's clock reads this wall time. The offset
 * is sampled twice because the first sample is taken at the wrong instant
 * whenever a DST transition sits between the two — harmless for Asia/Kolkata,
 * correct everywhere else.
 */
const instantOfWallClock = (wall: IWallClock, timeZone: string): Date => {
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );

  const firstOffset = offsetMsAt(new Date(asIfUtc), timeZone);
  let instant = asIfUtc - firstOffset;

  const secondOffset = offsetMsAt(new Date(instant), timeZone);
  if (secondOffset !== firstOffset) instant = asIfUtc - secondOffset;

  return new Date(instant);
};

/** "2026-09-16 18:30:00" — what postgres parses straight into a TIMESTAMP */
const formatWallClock = (instant: Date, timeZone: string) => {
  const w = wallClockIn(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)} ` +
    `${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`
  );
};

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** midnight of the given reporting-timezone calendar date, as an instant */
const startOfLocalDate = (date: string): Date => {
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));

  // Date.UTC rolls 2026-02-31 forward to March; rejecting it here means a
  // typo'd date is a 400 instead of a silently different window.
  const rolled = new Date(Date.UTC(year, month - 1, day));
  if (
    rolled.getUTCFullYear() !== year ||
    rolled.getUTCMonth() !== month - 1 ||
    rolled.getUTCDate() !== day
  ) {
    throw new ErrorHandler(400, `${date} is not a real calendar date`);
  }

  return instantOfWallClock(
    { year, month, day, hour: 0, minute: 0, second: 0 },
    REPORTING_TIMEZONE,
  );
};

/** n days before the given reporting-timezone calendar midnight */
const shiftLocalMidnight = (
  midnight: Date,
  shift: { days?: number; months?: number; years?: number },
) => {
  const wall = wallClockIn(midnight, REPORTING_TIMEZONE);
  return instantOfWallClock(
    {
      year: wall.year - (shift.years ?? 0),
      month: wall.month - (shift.months ?? 0),
      day: wall.day - (shift.days ?? 0),
      hour: 0,
      minute: 0,
      second: 0,
    },
    REPORTING_TIMEZONE,
  );
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A chart needs about 10-100 points to be readable. One point per hour stops
 * being one at two days, one per day stops being one at roughly a quarter.
 */
const bucketForSpan = (startAt: Date, endAt: Date): TRangeBucket => {
  const days = (endAt.getTime() - startAt.getTime()) / DAY_MS;
  if (days <= 2) return "hour";
  if (days <= 100) return "day";
  return "month";
};

export interface IDateRangeQuery {
  range?: string;
  start_date?: string;
  end_date?: string;
}

export const resolveDateRange = (query: IDateRangeQuery): IResolvedRange => {
  const preset = (query.range ?? "30d").toString().toLowerCase() as TRangePreset;

  if (!(preset in PRESET_LABELS)) {
    throw new ErrorHandler(
      400,
      `range must be one of ${Object.keys(PRESET_LABELS).join(", ")}`,
    );
  }

  const now = new Date();
  const todayWall = wallClockIn(now, REPORTING_TIMEZONE);
  const todayStart = instantOfWallClock(
    { ...todayWall, hour: 0, minute: 0, second: 0 },
    REPORTING_TIMEZONE,
  );
  // exclusive: the window runs to the end of today, so an order placed a
  // minute ago is already in it
  const tomorrowStart = shiftLocalMidnight(todayStart, { days: -1 });

  let startAt: Date;
  let endAt: Date;
  let bucket: TRangeBucket;
  let label: string = PRESET_LABELS[preset];

  switch (preset) {
    case "today":
      startAt = todayStart;
      endAt = tomorrowStart;
      bucket = "hour";
      break;

    // "7 days" is the last seven calendar days including today, which is what
    // someone comparing this week to last week expects — not 7 * 24 hours
    // rolling back from this minute.
    case "7d":
      startAt = shiftLocalMidnight(todayStart, { days: 6 });
      endAt = tomorrowStart;
      bucket = "day";
      break;

    case "30d":
      startAt = shiftLocalMidnight(todayStart, { days: 29 });
      endAt = tomorrowStart;
      bucket = "day";
      break;

    case "3m":
      startAt = shiftLocalMidnight(todayStart, { months: 3, days: -1 });
      endAt = tomorrowStart;
      bucket = "day";
      break;

    case "1y":
      startAt = shiftLocalMidnight(todayStart, { years: 1, days: -1 });
      endAt = tomorrowStart;
      bucket = "month";
      break;

    case "custom": {
      const from = (query.start_date ?? "").toString().trim();
      const to = (query.end_date ?? "").toString().trim();

      if (!CALENDAR_DATE.test(from) || !CALENDAR_DATE.test(to)) {
        throw new ErrorHandler(
          400,
          "range=custom needs start_date and end_date as YYYY-MM-DD",
        );
      }

      startAt = startOfLocalDate(from);
      // end_date is inclusive to the person picking it: "1st to 5th" has to
      // contain everything that happened on the 5th.
      endAt = shiftLocalMidnight(startOfLocalDate(to), { days: -1 });

      if (endAt.getTime() <= startAt.getTime()) {
        throw new ErrorHandler(400, "start_date must not be after end_date");
      }

      // A year of hourly rows is 8760 points nobody reads and a query that
      // pays for all of them. Two years is the ceiling on one request.
      if (endAt.getTime() - startAt.getTime() > 731 * DAY_MS) {
        throw new ErrorHandler(400, "A custom range cannot exceed 2 years");
      }

      bucket = bucketForSpan(startAt, endAt);
      label = `${from} to ${to}`;
      break;
    }

    default:
      throw new ErrorHandler(400, "Unsupported range");
  }

  return {
    preset,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    startAtLocal: formatWallClock(startAt, REPORTING_TIMEZONE),
    endAtLocal: formatWallClock(endAt, REPORTING_TIMEZONE),
    bucket,
    timezone: REPORTING_TIMEZONE,
    label,
  };
};
