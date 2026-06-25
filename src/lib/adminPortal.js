// Owners and admins default into their own section (/owner, /admin) — AppShell
// force-routes them there. This session preference lets them opt into the
// customer portal without being bounced back. Stored under a `washgo:`
// localStorage key so signOut clears it with the rest of the cached app state.
const KEY = "washgo:adminCustomerMode";

// True when the signed-in owner/admin has opted into the customer portal.
export function isCustomerPortalMode() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Back-compat alias (admins).
export const isAdminCustomerMode = isCustomerPortalMode;

// Opt into the customer portal and go there (won't be auto-redirected back).
export function enterCustomerPortal(router) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  router.push("/");
}

// Return to the owner/admin section; clears the preference so a later stray
// customer visit bounces back to `home` by default. `home` defaults to the admin
// console for back-compat.
export function exitCustomerPortal(router, home = "/admin") {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  router.push(home);
}
