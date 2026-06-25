// Licence-plate normalisation + matching, kept in sync with the SQL used by
// owner_complete_booking (regexp_replace(lower(plate), '[^a-z0-9]', '', 'g')).
// Vietnamese plates carry separators (e.g. "51G-248.19"), so we compare on
// lowercase alphanumerics only.

export function normalizePlate(plate) {
  return String(plate ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// True only when both plates are non-empty and normalise to the same string.
export function platesMatch(a, b) {
  const na = normalizePlate(a);
  const nb = normalizePlate(b);
  return na !== "" && na === nb;
}
