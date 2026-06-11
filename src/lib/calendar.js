// Lightweight, dependency-free calendar helpers used by the booking screen so
// its month arrows actually navigate and the grid never goes stale (it is built
// from the real current month rather than a hardcoded May 2026 array).

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Pad to two digits.
const pad = (n) => String(n).padStart(2, "0");

// A stable, locale-independent date id, e.g. "2026-06-13".
export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Parse an ISO id back to a local Date (noon avoids DST/timezone edge cases).
// Returns null for anything that isn't a YYYY-MM-DD string.
export function parseIsoDate(id) {
  if (typeof id !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "Sat 13 Jun" for an ISO id, or "" when the id isn't an ISO date.
export function formatIsoLabel(id) {
  const date = parseIsoDate(id);
  if (!date) return "";
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

// Header label for a viewed month, e.g. "June 2026".
export function formatMonthLabel(date) {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

// Return a new Date offset by `delta` whole months (day pinned to the 1st).
export function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

// Midnight today, for past-day comparisons.
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Build a 6x7 calendar matrix (42 cells) for the given month. Each cell carries
// its day number, an ISO id, and `muted` (outside the viewed month) / `past`
// (before today, not selectable) flags.
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startWeekday);
  const today = startOfToday();

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      day: date.getDate(),
      iso: toIsoDate(date),
      muted: date.getMonth() !== month,
      past: date < today
    });
  }
  return cells;
}

export { WEEKDAYS_SHORT };
