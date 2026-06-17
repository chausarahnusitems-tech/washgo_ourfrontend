// Admins default into /admin — AppShell force-routes them there. This session
// preference lets an admin opt into the customer portal without being bounced
// back. Stored under a `washgo:` localStorage key so signOut clears it with the
// rest of the cached app state.
const KEY = "washgo:adminCustomerMode";

export function isAdminCustomerMode() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Opt into the customer portal and go there (admin won't be auto-redirected back).
export function enterCustomerPortal(router) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  router.push("/");
}

// Return to the admin console; clears the preference so a later stray customer
// visit bounces back to /admin by default.
export function exitCustomerPortal(router) {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  router.push("/admin");
}
