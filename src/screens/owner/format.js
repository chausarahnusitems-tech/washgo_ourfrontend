// VND display formatting for the owner area (e.g. 199000 -> "199.000₫"),
// matching the dotted-thousands style used across the customer UI.
export function formatVnd(amount) {
  return `${Math.round(Number(amount) || 0)
    .toLocaleString("en-US")
    .replace(/,/g, ".")}₫`;
}
