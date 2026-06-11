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

export const dates = [
  { id: "today", number: "26", label: "today", sub: "May" },
  { id: "tomorrow", number: "27", label: "tomorrow", sub: "May" },
  { id: "sat", number: "28", label: "sat", sub: "May" },
  { id: "sun", number: "29", label: "sun", sub: "May" }
];

export const calendarDays = [
  { day: "26", muted: true },
  { day: "27", muted: true },
  { day: "28", muted: true },
  { day: "29", muted: true },
  { day: "30", muted: true },
  { day: "1" },
  { day: "2" },
  { day: "3" },
  { day: "4" },
  { day: "5" },
  { day: "6" },
  { day: "7" },
  { day: "8" },
  { day: "9" },
  { day: "10" },
  { day: "11" },
  { day: "12" },
  { day: "13" },
  { day: "14" },
  { day: "15" },
  { day: "16" },
  { day: "17" },
  { day: "18" },
  { day: "19" },
  { day: "20" },
  { day: "21" },
  { day: "22" },
  { day: "23" },
  { day: "24" },
  { day: "25" },
  { day: "26", id: "today" },
  { day: "27", id: "tomorrow" },
  { day: "28", id: "sat" },
  { day: "29", id: "sun" },
  { day: "30" },
  { day: "31" },
  { day: "1", muted: true },
  { day: "2", muted: true },
  { day: "3", muted: true },
  { day: "4", muted: true },
  { day: "5", muted: true },
  { day: "6", muted: true }
];

export const times = ["10.00AM", "12.00PM", "12.30PM", "2.00PM", "4.00PM", "5.30PM"];
