Washgo is a webapp for car owners to book car washes. It will be used in Vietnam's marketplace, so both english and vietnam options should be provided. All prices are shown in Vietnamese Dong (VND, ₫).

Cash Wallet (currency)
1. Washgo uses a pure cash system. Each user has a cash wallet balance (in VND) that is used to pay for bookings in the marketplace.
2. Users top up their wallet with funds at any time (Account → Top Up Funds). The top-up page is currently a local-only fake flow that adjusts the balance directly; a real payment backend will replace it.
3. Booking a wash deducts the total cost from the wallet balance.

Membership (optional)
1. Users can choose between membership tiers:
    - Basic: member rates at every shop
    - Premium: 10% off every wash + priority slots + free birthday wash
2. Membership is separate from the cash wallet — it unlocks perks and a checkout discount, it does not add funds. The wallet is topped up by the user independently.

Marketplace
1. User is able to view all available CarWash shops in the area through
    - quick view
    - search up locations

Booking and Purchasing Slots
1. User chooses a CarWash shop
2. User inputs date, time and necessary details
3. User can customise the services they want (eg, exterior, interior, etc)
4. At the end of the page, the total cost is shown in VND
5. The "Book" / Confirm Booking button charges the wallet and opens a clean Booking Confirmed page
    - The confirmed page has a cross (X) button to close and return home, and a button to jump to the Bookings page
6. The Bookings page lists cards for every booked slot

Claiming free car washes:
1. (Following from above) After confirming the booking and paying from the wallet, the journey card will be updated to increase by one stamp
2. When 5 stamps have been collected, users are given 1 free car wash voucher to be used anywhere
