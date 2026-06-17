// Runtime mode switch.
//
// DEMO_MODE (NEXT_PUBLIC_DEMO_MODE="true") runs the whole app on local state
// with NO backend: shops/services/plans come from the hardcoded catalog and
// bookings/favourites/wallet live in localStorage — exactly the original
// behaviour, usable signed-out with no Supabase project. This is the escape
// hatch for demos, previews and offline development.
//
// When DEMO_MODE is off (the default), the app is backend-driven: reference
// data is read from the database and booking/favourite/top-up are persisted per
// user through the RPCs — which require a signed-in user. `isDemo(supabase)`
// also falls back to demo when Supabase isn't configured at all, so a missing
// .env never leaves a blank, dead app.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function isDemo(supabase) {
  return DEMO_MODE || !supabase;
}
