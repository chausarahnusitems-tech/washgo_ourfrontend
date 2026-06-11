// Membership tiers. These no longer grant wallet funds — the cash wallet is
// topped up separately. Membership unlocks perks and a checkout discount.
export const plans = [
  { id: "basic", price: "99.000₫" },
  { id: "premium", price: "199.000₫", badge: true }
];

export const shops = [
  {
    id: "sparkle",
    name: "Sparkle Auto Wash",
    district: "Thảo Điền",
    address: "12 Nguyen Van Huong, Thu Duc, Ho Chi Minh City",
    distance: "0.4 km",
    rating: "4.9",
    reviews: "2.1k",
    starting: 50000,
    wait: "12 min",
    services: ["exterior", "interior", "detailing"],
    imagePosition: "object-[58%_center]",
    // `open` / `hours` drive the availability badge; `promo` gates the
    // "Free wash" corner badge so it isn't shown on every shop.
    open: true,
    hours: "07:00 - 22:00",
    promo: true,
    lat: 10.8045,
    lng: 106.7385
  },
  {
    id: "saigon",
    name: "Saigon Shine Hub",
    district: "Bình Thạnh",
    address: "88 Xo Viet Nghe Tinh, Binh Thanh, Ho Chi Minh City",
    distance: "1.1 km",
    rating: "4.8",
    reviews: "870",
    starting: 40000,
    wait: "18 min",
    services: ["exterior", "wax", "interior"],
    imagePosition: "object-[42%_center]",
    open: true,
    hours: "24 Hrs",
    promo: true,
    lat: 10.8108,
    lng: 106.7156
  },
  {
    id: "lotus",
    name: "Lotus Detail Studio",
    district: "District 7",
    address: "21 Nguyen Thi Thap, District 7, Ho Chi Minh City",
    distance: "2.3 km",
    rating: "4.7",
    reviews: "640",
    starting: 60000,
    wait: "25 min",
    services: ["detailing", "wax", "interior"],
    imagePosition: "object-[74%_center]",
    open: false,
    hours: "08:00 - 20:00",
    promo: false,
    lat: 10.7898,
    lng: 106.7218
  }
];

// Approximate "current location" used to centre the map and drop the user pin.
export const userLocation = { lat: 10.7995, lng: 106.7305 };

// Prices are in Vietnamese Dong (VND), charged against the user's cash wallet.
export const services = [
  { id: "exterior", price: 50000, icon: "Car" },
  { id: "interior", price: 50000, icon: "Armchair" },
  { id: "detailing", price: 100000, icon: "Sparkles" },
  { id: "wax", price: 60000, icon: "ShieldCheck" }
];

// Quick-pick dates used by the booking-detail edit chips. The full booking
// calendar is generated dynamically from the real current month (see
// src/lib/calendar.js) so its month arrows work and never go stale.
export const dates = [
  { id: "today", number: "11", label: "today", sub: "Jun" },
  { id: "tomorrow", number: "12", label: "tomorrow", sub: "Jun" },
  { id: "sat", number: "13", label: "sat", sub: "Jun" },
  { id: "sun", number: "14", label: "sun", sub: "Jun" }
];

export const times = ["10.00AM", "12.00PM", "12.30PM", "2.00PM", "4.00PM", "5.30PM"];
