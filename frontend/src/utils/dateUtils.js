// RecentActions.timestamp (and similar backend fields) are stored via
// SQLite's CURRENT_TIMESTAMP - a naive UTC string with no 'Z'/offset (e.g.
// "2026-10-01 19:30:00"). Parsing that string directly with `new Date()` is
// ambiguous: V8 parses space-separated non-ISO datetimes as LOCAL time, not
// UTC, silently shifting the actual moment by the browser's UTC offset. This
// makes the UTC-ness explicit before parsing.
export const parseUtcTimestamp = (timestamp) => {
  const isoish = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  return new Date(isoish.endsWith('Z') ? isoish : `${isoish}Z`);
};

// "Today"/"this day" has to mean the viewer's LOCAL calendar day, not UTC's -
// UTC midnight falls in the afternoon/evening for any US timezone, so
// comparing by UTC date (e.g. toISOString().split('T')[0]) counts part of
// yesterday evening (local) as "today".
export const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
