// Allow only a relative in-app path as a navigation / redirect target. Rejects
// absolute URLs, protocol-relative ("//host"), and backslash tricks ("/\host")
// that browsers normalize to protocol-relative — i.e. all open-redirect vectors.
// Returns "" when the input is unsafe. Plain module (no React/DOM) so both the
// server route and client screens can share it.
export function safeNextPath(raw) {
  return typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
    ? raw
    : "";
}
