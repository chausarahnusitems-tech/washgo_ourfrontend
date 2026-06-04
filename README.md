# Washgo Prototype Brief

Washgo is a web app concept for car owners in Vietnam to discover and book car wash services. The intended prototype is a clickable customer journey that demonstrates how users choose a token plan, browse nearby car wash shops, book a slot, pay with tokens, and earn rewards.

This repository includes a static clickable prototype. It does not include a backend, authentication, real payments, maps integration, or live shop availability.

## Prototype Goal

The prototype communicates the end-to-end customer experience for demo and planning purposes. It uses mocked data and focuses on the core booking journey rather than production infrastructure.

The prototype supports both English and Vietnamese language options.

## Core User Flows

### 1. User Onboarding

Users choose a token plan before using the marketplace:

- Basic: 50 tokens
- Premium: 100 tokens

Tokens are the marketplace currency used to pay for car wash bookings.

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

From this folder, open the prototype directly:

```bash
open index.html
```

Or serve it locally:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

No package install, build command, or local server is required for the current static prototype.

## Project Structure

```text
.
├── index.html
├── src/
│   ├── app.js
│   └── styles.css
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
