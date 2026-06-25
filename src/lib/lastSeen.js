// Per-user "last seen" timestamps for nav notification badges. A section's badge
// counts items newer than the last time the user opened that section. Stored
// under `washgo:` localStorage keys so signOut clears them with the rest of the
// cached app state. Namespaced by user id so switching accounts is clean.
const PREFIX = "washgo:seen:";

function storageKey(userId, key) {
  return `${PREFIX}${userId}:${key}`;
}

// Last-seen time for a section as a ms epoch (0 when never recorded).
export function getSeen(userId, key) {
  if (typeof window === "undefined" || !userId) return 0;
  try {
    const v = window.localStorage.getItem(storageKey(userId, key));
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}

// Record "seen everything up to now" for a section (clears its badge).
export function markSeen(userId, key) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId, key), String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Initialise a baseline of "now" the first time we see a user, so their existing
// history doesn't flood the badges — only items received afterwards count as new.
export function ensureSeen(userId, key) {
  if (typeof window === "undefined" || !userId) return;
  try {
    if (window.localStorage.getItem(storageKey(userId, key)) == null) markSeen(userId, key);
  } catch {
    /* ignore */
  }
}
