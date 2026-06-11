# Washgo Prototype

Washgo is a web app concept for car owners in Vietnam to discover and book car
wash services. It is a clickable customer-journey prototype: choose a membership
tier, browse nearby shops, book a slot, pay from a cash wallet, and earn rewards.

This repository is a **front-end only** prototype. There is no backend, auth,
real payments, or live shop availability — all data is mocked and all state is
held client-side and persisted to `localStorage`. The backend will be added
afterwards; the code is structured so the local fakes (top-up, booking, chat)
can be swapped for real APIs.

The prototype supports both **English and Vietnamese**.

## Cash Wallet (currency)

Washgo uses a pure cash system. Each user has a wallet balance in Vietnamese Dong
(VND, ₫) used to pay for bookings.

- Users top up the wallet at any time (**Account → Top Up Funds**). The top-up
  page is a local-only fake flow that adjusts the balance directly.
- Booking a wash deducts the total from the wallet. Checkout is **balance-guarded**
  — a booking can't be confirmed (or edited to a higher price) without sufficient
  funds; an "Insufficient balance → Top up" affordance links to the top-up page.

## Membership (optional)

Membership is separate from the wallet — it unlocks perks and a checkout discount,
it does not add funds.

- **Basic** — member rates at every shop.
- **Premium** — 10% off every wash + priority slots + free birthday wash.

Each booking records the plan it was priced under, so later edits reprice
honestly instead of retroactively applying the current plan.

## Rewards

Every confirmed (paid) booking adds one stamp to the journey card. At five stamps
the user unlocks a **free-wash voucher**. Tapping *Use voucher* arms it, and the
next booking is applied for free, consuming the voucher and restarting the card.
Cancelling/deleting a booking reverses the stamp it granted (no free-wash farming).

## Core User Flows

1. **Onboarding** — the app opens on the **Home** marketplace (wallet seeded so it
   is usable immediately). Choosing/upgrading a plan is an optional step from
   **Account → Upgrade Plan**.
2. **Discovery** — browse shops via cards, free-text search, quick-view, the
   interactive map, and **service filters** (Explore filter chips).
3. **Booking** — pick a shop, date (dynamic month calendar), time, and services;
   enter vehicle model / plate / notes; review the VND total; confirm to charge
   the wallet and open the Booking Confirmed page.
4. **Bookings** — upcoming and history lists; open a booking to edit, cancel
   (refunds), rebook, or delete.

## Implemented Local-Only Features

These work fully client-side (no backend):

- Cash wallet with top-up, balance-guarded checkout, and edit/cancel/delete refunds
- Free-wash voucher redemption + loyalty-card reset; stamp reversal on cancel/delete
- Membership plans + premium checkout discount (priced per booking)
- Marketplace search **and service filtering** (Explore chips, URL-driven)
- Favourites (Heart toggle, persisted) on shop cards and the detail card
- Share (Web Share API with clipboard fallback) on the shop detail card
- Interactive MapLibre map with diffed shop pins + "you are here" puck
- Dynamic month calendar with working prev/next navigation
- Vehicle model / plate / notes capture
- Data-driven open/closed + opening hours per shop
- Support **chat placeholder** (canned auto-reply, local message list) at `/chat`
- English / Vietnamese throughout, including aria-labels

## Out of Scope (backend to follow)

Backend APIs, authentication, real payments / top-ups, real-time availability,
real geolocation, merchant dashboards, admin tools, and production voucher
validation.

## Run the Prototype

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:3000

Production build:

```bash
npm run build
npm start
```

## Project Structure

```text
.
├── next.config.mjs
├── tailwind.config.js
├── jsconfig.json            # "@/*" -> "./src/*"
├── public/                  # images, icons, map style (served at the web root)
├── src/
│   ├── app/                 # Next.js App Router routes (thin wrappers)
│   ├── screens/             # Screen components (mobile + desktop variants)
│   ├── components/          # UI primitives, layout, cards, map
│   ├── lib/                 # AppContext (state), booking, calendar, hooks
│   └── data/                # catalog (shops/services/dates) + copy (EN/VI)
├── docs/
│   ├── AGENT.md             # original concept
│   └── StyleGuide.json
└── README.md
```

State lives in two places: domain/session state (wallet, bookings, stamps,
favourites, language) in `src/lib/AppContext.jsx` (persisted to `localStorage`),
and navigation state (search `?q`, map `?shop`, filter `?service`, quick-view
`?quick`) in the URL.
