# Washgo Prototype Brief

Washgo is a web app concept for car owners in Vietnam to discover and book car wash services. The intended prototype is a clickable customer journey that demonstrates how users choose a token plan, browse nearby car wash shops, book a slot, pay with tokens, and earn rewards.

This repository includes a static clickable prototype. It does not include a backend, authentication, real payments, maps integration, or live shop availability.

## Prototype Goal

The prototype communicates the end-to-end customer experience for demo and planning purposes. It uses mocked data and focuses on the core booking journey rather than production infrastructure.

The prototype supports both English and Vietnamese language options.

## Core User Flows

### 1. User Onboarding

The app opens directly on the **Home** marketplace (seeded with the premium plan's
100-token balance). Choosing or upgrading a token plan is now an optional step
reached from **Account → Upgrade Plan**:

- Basic: 50 tokens
- Premium: 100 tokens

Tokens are the marketplace currency used to pay for car wash bookings. The
membership plans screen includes a back button that returns to the screen it was
opened from.

### 2. Marketplace Discovery

Users can browse available car wash shops in their area through:

- Quick view cards
- Location search

The prototype can use mocked shops and locations instead of real geolocation or map data.

### 3. Booking and Purchasing Slots

Users should be able to:

- Choose a car wash shop
- Enter the booking date, time, and necessary vehicle details
- Customize selected services, such as exterior wash or interior cleaning
- Review the final total cost in tokens
- Confirm the booking using tokens

### 4. Rewards and Free Car Washes

After a user confirms a booking and pays with tokens:

- The user's journey card gains one stamp
- Once five stamps are collected, the user receives one free car wash voucher
- The free voucher can be shown as redeemable at any participating car wash shop

## Implementation Status

Audited against the flows above. Status reflects the clickable prototype, not a
production build.

| Feature | Status | Notes |
| --- | --- | --- |
| Home as landing page | ✅ Done | Opens on Home; tokens seeded to 100. |
| Membership plans from Account | ✅ Done | `Account → Upgrade Plan`; plans screen has a back button. |
| English / Vietnamese toggle | ✅ Done | Some `aria-label`s are still hardcoded English (see gaps). |
| Marketplace browse (cards + search) | ✅ Done | Search filters by name/district/address/services. |
| Map / explore view | ✅ Done | Interactive map with shop pins and a detail sheet. |
| Shop detail | ⚠️ Partial | "Show more" jumps to booking instead of expanding; rating/reviews not shown on the detail screen. |
| Booking (date, time, services, vehicle) | ⚠️ Partial | Captures plate + notes only; vehicle model is not editable. Calendar month arrows are inert. |
| Pay with tokens | ⚠️ Partial | No balance check — a booking can be confirmed with insufficient tokens (balance floors at 0). |
| Confirmation + stamp increment | ✅ Done | Adds one stamp, caps at 5, unlocks voucher at 5. |
| Rewards / journey card | ✅ Done | 5-stamp progress, voucher unlock. |
| Vouchers list | ✅ Done | "Use now / Use voucher" routes Home; no redemption flow (out of scope). |
| Bookings history | ⚠️ Partial | Stores a single booking; a new booking overwrites the previous one. |
| Chat | ❌ Missing | Nav item exists in top/bottom nav but is a no-op. |

## Known Gaps & Issues

**Flow**

- **No token-balance guard at checkout** — `confirmBooking` deducts with
  `Math.max(0, tokens - total)`, so an unaffordable booking still confirms and the
  balance silently floors at 0. Should block or warn when `total > tokens`.
- **"Show more" on the shop detail screen navigates to Booking** instead of
  expanding details (the map detail card expands correctly; the full-screen detail
  screen does not).
- **Top-nav "Join Us"** opens the plans screen via the generic navigation, which
  does not record the originating screen, so the plans back button falls back to
  Home rather than returning to the prior page.

**Dead / non-functional buttons**

- **Chat** — present in both bottom nav and top nav, wired to nothing.
- **Share** and the **Heart / favourite** icon on the shop detail card have no
  handlers.
- **Calendar month ◀ / ▶ arrows** on the booking screen do nothing (the calendar
  is fixed to May 2026).
- **Filter** icon (Home search) and the **filter chips** (Explore) are decorative —
  no filtering logic is attached.

**Missing information / data**

- **Vehicle model** is shown on the desktop Home dashboard but cannot be entered or
  edited during booking (only plate + notes are captured).
- **Bookings** is a single object, not a list — there is no booking history.
- **Open / Closed** state is hardcoded by index on the desktop Home cards rather
  than driven by shop data (no `open` field exists in the catalog).
- **Rating / reviews / wait time** exist in the catalog but are only surfaced in the
  expanded map detail card (`ShopDetailCard` on Explore).

**Internationalisation**

- Hardcoded English `aria-label`s ("Back", "Share") in `ShopDetailCard` and
  `ExploreScreen` should use the `back` / a `share` copy key.
- Unused copy keys remain in `data/copy.js` (e.g. `planSubtitle`, `plateValue`,
  `nearby`).

## Prototype Scope

In scope:

- Clickable end-to-end customer flow
- Mocked plan, token, shop, service, slot, stamp, and voucher data
- English and Vietnamese language support
- Demo-friendly screens for plan selection, marketplace browsing, booking, checkout, confirmation, and rewards

Out of scope for the first prototype:

- Backend APIs
- User authentication
- Real token purchases or payment processing
- Real-time shop availability
- Real geolocation or maps integration
- Merchant dashboards
- Admin tools
- Production voucher validation

## Run the Prototype

Install dependencies:

```bash
npm install
```

Start the React dev server:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

Create a production build:

```bash
npm run build
```

## Project Structure

```text
.
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles.css
│   ├── components/
│   ├── data/
│   ├── lib/
│   └── screens/
├── assets/
│   └── images/
│       ├── car-icon.png
│       ├── profile-face.png
│       └── car-wash-hero.png
├── docs/
│   ├── AGENT.md
│   ├── StyleGuide.json
│   └── reference/
│       └── prisma/
└── README.md
```

## Suggested Future Work

Future product and technical work could include:

- Merchant shop and slot management
- Real geolocation and map search
- User accounts and authentication
- Payment integration for token purchases
- Token ledger and transaction history
- Voucher redemption and validation flow
- Backend APIs and database models
- Admin tools for marketplace operations

## Review Criteria

The prototype brief should:

- Accurately reflect the original Washgo concept in `docs/AGENT.md`
- Make clear that this is a static prototype, not a completed product
- Be useful for both demo stakeholders and future developers
- Keep setup instructions accurate for the static prototype
