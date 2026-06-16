// Predefined services a car wash can offer, used to populate the service
// <select> on the listing application form (so owners pick instead of typing).
// Prices are suggested defaults in VND (k = thousand, tr/triệu = million); for
// listed ranges the lower bound is used as the default. Owners can edit the
// price, and "Other" lets them add a service not in this list.
export const SERVICE_OPTION_GROUPS = [
  {
    label: "Service packages",
    options: [
      { name: "German-Standard Car Wash (WÜRTH Technology)", price: 150000 },
      { name: "Advanced Service Package", price: 250000 },
      { name: "Premium Service Package", price: 650000 },
      { name: "Comprehensive Cleaning", price: 1800000 }
    ]
  },
  {
    label: "Optional services",
    options: [
      { name: "Interior deodorization", price: 150000 },
      { name: "Plastic/rubber maintenance", price: 350000 },
      { name: "Glass paint overspray removal", price: 400000 },
      { name: "Leather/fabric maintenance", price: 350000 },
      { name: "Paint surface cleaning", price: 500000 },
      { name: "Paint surface maintenance", price: 500000 },
      { name: "Air conditioner deodorization", price: 500000 },
      { name: "Glass polishing", price: 1400000 },
      { name: "Paint polishing", price: 1500000 },
      { name: "Underbody coating", price: 3500000 },
      { name: "Soundproofing", price: 12500000 }
    ]
  }
];

// The sentinel value used by the "Other (custom service)" <option>.
export const CUSTOM_SERVICE = "__custom__";

// Flat name -> suggested price lookup for prefilling the price input.
export const SERVICE_PRICE_BY_NAME = Object.fromEntries(
  SERVICE_OPTION_GROUPS.flatMap((g) => g.options).map((o) => [o.name, o.price])
);
