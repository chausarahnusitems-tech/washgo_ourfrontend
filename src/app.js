const imagePath = "assets/images/car-wash-hero.png";
const profileImagePath = "assets/images/profile-face.png";

const iconPaths = {
  arrowLeft: '<path d="M15 18l-6-6 6-6"/><path d="M9 12h12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  car: '<path d="M7 17h10"/><path d="M5 17h14l-1.4-5.6A3 3 0 0 0 14.7 9H9.3a3 3 0 0 0-2.9 2.4L5 17Z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  gift: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8v12"/><path d="M4 12h16"/><path d="M7.5 8a2.5 2.5 0 1 1 4.5-1.5V8"/><path d="M16.5 8A2.5 2.5 0 1 0 12 6.5V8"/>',
  heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6Z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 4.8 2.4c-.9.6-1.4 1.1-1.4 2.1"/><path d="M12 17h.01"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-7h6v7"/>',
  interior: '<path d="M6 18V9a4 4 0 0 1 8 0v9"/><path d="M4 18h16"/><path d="M14 12h4a2 2 0 0 1 2 2v4"/>',
  location: '<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4"/><path d="m8.6 13.5 6.8 4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  sparkle: '<path d="m12 3 1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  wallet: '<path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M16 13h5"/><path d="M17 13h.01"/>'
};

function icon(name, className = "") {
  if (name === "car") {
    return `<span class="icon car-mask ${className}" aria-hidden="true"></span>`;
  }

  return `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
}

const copy = {
  en: {
    memberUntil: "Member valid till",
    dateUntil: "24 May 2026",
    tokens: "tokens",
    tokenShort: "Tk",
    basic: "Basic",
    premium: "Premium",
    bestValue: "20% Extra",
    choosePlan: "Membership Plans",
    planSubtitle: "Choose how many Washgo tokens to start with.",
    basicPerk: "50 tokens monthly",
    premiumPerk: "100 tokens monthly",
    premiumExtra: "10 bonus tokens for add-ons",
    trustPlan: "Change plans or cancel anytime",
    guarantee: "7-day money back guarantee",
    continue: "Continue",
    heroTitle: "Premium Care for Your Car",
    heroCopy: "Vietnam's top car wash ecosystem",
    searchPlaceholder: "Search car washes",
    recommended: "Recommended",
    quickView: "Quick view",
    close: "Close",
    open: "Open",
    services: "Services",
    exterior: "Car Wash",
    interior: "Interior Cleaning",
    detailing: "Detailing",
    wax: "Wax Finish",
    moreServices: "More",
    promoTitle: "Far From Home?",
    promoCopy: "We have 200+ locations across Vietnam",
    freeWash: "Free Wash",
    serviceIncluded: "Services Included",
    showMore: "Show more",
    startingAt: "Starting at",
    bookNow: "Book Now",
    selectDate: "Select Date",
    selectTime: "Select Time Slot",
    chooseServices: "Choose Services",
    serviceHint: "Select one or multiple",
    monthMay2026: "May 2026",
    advanceDeal: "Book 5+ days in advance for 10% OFF",
    serviceSummary: "Service Summary",
    vehicleDetails: "Vehicle Details",
    licensePlate: "License plate",
    notes: "Notes",
    notesPlaceholder: "Vehicle type, parking note, special request",
    tokenDetails: "Token Details",
    discount: "Member discount",
    total: "Total",
    confirmBooking: "Confirm Booking",
    confirmedTitle: "Booking Confirmed",
    confirmedCopy: "Your journey card gained one stamp.",
    rewardsTitle: "Wash Rewards",
    rewardsCopy: "Every 5 washes = 1 free wash",
    washesCompleted: "washes completed",
    voucherTitle: "Free Car Wash",
    voucherCopy: "Unlocked and ready to use anywhere",
    voucherLocked: "Collect 5 stamps to unlock your free wash voucher.",
    currentVouchers: "Current Vouchers",
    voucherCount: "vouchers available",
    discountVoucherTitle: "10% off Detailing",
    discountVoucherCopy: "Save on polish, deep clean, and finishing services.",
    expires: "Expires",
    code: "Code",
    useNow: "Use now",
    viewRewards: "View Rewards",
    bookAnother: "Book Another",
    myTokens: "My Tokens",
    upgradePlan: "Upgrade Plan",
    profileName: "Sarah Nguyen",
    memberSince: "Member since Jun 2026",
    bookings: "Bookings",
    noBookings: "No booking yet. Choose a shop to start.",
    home: "Home",
    rewards: "Rewards",
    account: "Account",
    resetDemo: "Reset Demo",
    noResults: "No matching shops found.",
    nearby: "0.4 km",
    hours: "24 Hrs",
    useVoucher: "Use voucher",
    selected: "Selected",
    add: "Add",
    plateValue: "51G-248.19",
    today: "Today",
    tomorrow: "Tomorrow",
    sat: "Sat",
    sun: "Sun"
  },
  vi: {
    memberUntil: "Hội viên đến",
    dateUntil: "24 Thg 5 2026",
    tokens: "token",
    tokenShort: "Tk",
    basic: "Cơ bản",
    premium: "Cao cấp",
    bestValue: "Thêm 20%",
    choosePlan: "Gói Thành Viên",
    planSubtitle: "Chọn số token Washgo để bắt đầu.",
    basicPerk: "50 token mỗi tháng",
    premiumPerk: "100 token mỗi tháng",
    premiumExtra: "10 token thưởng cho dịch vụ thêm",
    trustPlan: "Đổi hoặc hủy gói bất cứ lúc nào",
    guarantee: "Hoàn tiền trong 7 ngày",
    continue: "Tiếp tục",
    heroTitle: "Chăm Sóc Cao Cấp Cho Xe",
    heroCopy: "Hệ sinh thái rửa xe hàng đầu Việt Nam",
    searchPlaceholder: "Tìm tiệm rửa xe",
    recommended: "Gợi ý",
    quickView: "Xem nhanh",
    close: "Đóng",
    open: "Đang mở",
    services: "Dịch vụ",
    exterior: "Rửa xe",
    interior: "Vệ sinh nội thất",
    detailing: "Chăm sóc chi tiết",
    wax: "Phủ sáp bóng",
    moreServices: "Thêm",
    promoTitle: "Xa Nhà?",
    promoCopy: "Washgo có hơn 200 địa điểm khắp Việt Nam",
    freeWash: "Rửa miễn phí",
    serviceIncluded: "Dịch vụ bao gồm",
    showMore: "Xem thêm",
    startingAt: "Từ",
    bookNow: "Đặt Ngay",
    selectDate: "Chọn Ngày",
    selectTime: "Chọn Khung Giờ",
    chooseServices: "Chọn Dịch Vụ",
    serviceHint: "Chọn một hoặc nhiều dịch vụ",
    monthMay2026: "Tháng 5 2026",
    advanceDeal: "Đặt trước 5+ ngày để giảm 10%",
    serviceSummary: "Tóm tắt dịch vụ",
    vehicleDetails: "Thông Tin Xe",
    licensePlate: "Biển số xe",
    notes: "Ghi chú",
    notesPlaceholder: "Loại xe, ghi chú gửi xe, yêu cầu riêng",
    tokenDetails: "Chi Tiết Token",
    discount: "Ưu đãi hội viên",
    total: "Tổng",
    confirmBooking: "Xác Nhận Đặt Lịch",
    confirmedTitle: "Đã Xác Nhận",
    confirmedCopy: "Thẻ hành trình của bạn đã thêm một dấu.",
    rewardsTitle: "Thưởng Rửa Xe",
    rewardsCopy: "Mỗi 5 lần rửa = 1 lần miễn phí",
    washesCompleted: "lần đã hoàn thành",
    voucherTitle: "Rửa Xe Miễn Phí",
    voucherCopy: "Đã mở khóa và có thể dùng ở mọi nơi",
    voucherLocked: "Thu thập 5 dấu để mở voucher rửa miễn phí.",
    currentVouchers: "Voucher Hiện Có",
    voucherCount: "voucher khả dụng",
    discountVoucherTitle: "Giảm 10% chăm sóc chi tiết",
    discountVoucherCopy: "Tiết kiệm cho đánh bóng, vệ sinh sâu và hoàn thiện xe.",
    expires: "Hết hạn",
    code: "Mã",
    useNow: "Dùng ngay",
    viewRewards: "Xem Thưởng",
    bookAnother: "Đặt Thêm",
    myTokens: "Token Của Tôi",
    upgradePlan: "Nâng Cấp",
    profileName: "Sarah Nguyen",
    memberSince: "Hội viên từ Thg 6 2026",
    bookings: "Lịch hẹn",
    noBookings: "Chưa có lịch hẹn. Hãy chọn một tiệm để bắt đầu.",
    home: "Trang chủ",
    rewards: "Thưởng",
    account: "Tài khoản",
    resetDemo: "Đặt Lại Demo",
    noResults: "Không tìm thấy tiệm phù hợp.",
    nearby: "0,4 km",
    hours: "24 giờ",
    useVoucher: "Dùng voucher",
    selected: "Đã chọn",
    add: "Thêm",
    plateValue: "51G-248.19",
    today: "Hôm nay",
    tomorrow: "Ngày mai",
    sat: "Thứ 7",
    sun: "CN"
  }
};

const plans = [
  { id: "basic", tokens: 50, price: "50" },
  { id: "premium", tokens: 100, price: "100", badge: true }
];

const shops = [
  {
    id: "sparkle",
    name: "Sparkle Auto Wash",
    district: "Thảo Điền",
    address: "12 Nguyen Van Huong, Thu Duc, Ho Chi Minh City",
    distance: "0.4 km",
    rating: "4.9",
    reviews: "2.1k",
    starting: 10,
    wait: "12 min",
    services: ["exterior", "interior", "detailing"],
    imageClass: "shop-focus-a"
  },
  {
    id: "saigon",
    name: "Saigon Shine Hub",
    district: "Bình Thạnh",
    address: "88 Xo Viet Nghe Tinh, Binh Thanh, Ho Chi Minh City",
    distance: "1.1 km",
    rating: "4.8",
    reviews: "870",
    starting: 8,
    wait: "18 min",
    services: ["exterior", "wax", "interior"],
    imageClass: "shop-focus-b"
  },
  {
    id: "lotus",
    name: "Lotus Detail Studio",
    district: "District 7",
    address: "21 Nguyen Thi Thap, District 7, Ho Chi Minh City",
    distance: "2.3 km",
    rating: "4.7",
    reviews: "640",
    starting: 12,
    wait: "25 min",
    services: ["detailing", "wax", "interior"],
    imageClass: "shop-focus-c"
  }
];

const services = [
  { id: "exterior", token: 5, icon: "car" },
  { id: "interior", token: 5, icon: "interior" },
  { id: "detailing", token: 10, icon: "sparkle" },
  { id: "wax", token: 6, icon: "shield" }
];

const dates = [
  { id: "today", number: "26", label: "today", sub: "May" },
  { id: "tomorrow", number: "27", label: "tomorrow", sub: "May" },
  { id: "sat", number: "28", label: "sat", sub: "May" },
  { id: "sun", number: "29", label: "sun", sub: "May" }
];

const times = ["10.00AM", "12.00PM", "12.30PM", "2.00PM", "4.00PM", "5.30PM"];

const state = {
  lang: "en",
  screen: "plans",
  selectedPlan: "premium",
  tokens: 0,
  stamps: 4,
  voucher: false,
  booking: null,
  selectedShop: "sparkle",
  selectedServices: new Set(["exterior", "interior"]),
  selectedDate: "today",
  selectedTime: "12.00PM",
  search: "",
  quickShop: null,
  vehicle: {
    plate: "51G-248.19",
    notes: ""
  }
};

const app = document.querySelector("#app");

function t(key) {
  return copy[state.lang][key] || copy.en[key] || key;
}

function money(value) {
  return `${value} ${t("tokens")}`;
}

function currentPlan() {
  return plans.find((plan) => plan.id === state.selectedPlan) || plans[1];
}

function currentShop() {
  return shops.find((shop) => shop.id === state.selectedShop) || shops[0];
}

function selectedServices() {
  return services.filter((service) => state.selectedServices.has(service.id));
}

function subtotal() {
  return selectedServices().reduce((sum, service) => sum + service.token, 0);
}

function discount() {
  return state.selectedPlan === "premium" && subtotal() > 0 ? 1 : 0;
}

function total() {
  return Math.max(0, subtotal() - discount());
}

function serviceName(id) {
  return t(id);
}

function frame(content, options = {}) {
  const nav = options.nav ? renderNav(options.nav) : "";
  return `
    <div class="screen-frame ${options.className || ""}">
      ${content}
      ${nav}
    </div>
  `;
}

function render() {
  const screens = {
    plans: renderPlans,
    home: renderHome,
    detail: renderDetail,
    booking: renderBooking,
    confirmation: renderConfirmation,
    bookings: renderBookings,
    rewards: renderRewards,
    vouchers: renderVouchers,
    account: renderAccount
  };
  app.innerHTML = (screens[state.screen] || renderHome)();
  document.documentElement.lang = state.lang;
  wireInputs();
}

function topBar({ back, title, subtitle, compact = false } = {}) {
  return `
    <header class="topbar ${compact ? "topbar-compact" : ""}">
      <div class="topbar-left">
        ${back ? `<button class="icon-button" type="button" data-action="${back.action}" data-screen="${back.screen || ""}" aria-label="${back.label || "Back"}">${icon("arrowLeft")}</button>` : `<button class="brand" type="button" data-action="brand-home" aria-label="Washgo home"><span class="brand-mark">${icon("car")}</span><span>WASHGO</span></button>`}
        ${title ? `<div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>` : ""}
      </div>
      <div class="topbar-right">
        ${!compact ? `<div class="validity"><span>${t("memberUntil")}</span><strong>${t("dateUntil")}</strong></div>` : ""}
        <div class="lang-toggle" role="group" aria-label="Language">
          <button class="${state.lang === "en" ? "is-active" : ""}" type="button" data-lang="en">EN</button>
          <button class="${state.lang === "vi" ? "is-active" : ""}" type="button" data-lang="vi">VI</button>
        </div>
      </div>
    </header>
  `;
}

function renderPlans() {
  const cards = plans.map((plan) => {
    const selected = state.selectedPlan === plan.id;
    return `
      <button class="plan-card ${selected ? "is-selected" : ""}" type="button" data-action="select-plan" data-plan="${plan.id}" aria-pressed="${selected}">
        ${plan.badge ? `<span class="plan-badge">${t("bestValue")}</span>` : ""}
        <span class="select-dot">${selected ? icon("check") : ""}</span>
        <span class="plan-copy">
          <strong>${plan.id === "basic" ? t("basic") : t("premium")}</strong>
          <span>${plan.id === "basic" ? t("basicPerk") : t("premiumPerk")}</span>
          ${plan.id === "premium" ? `<span>${t("premiumExtra")}</span>` : ""}
        </span>
        <span class="plan-price"><strong>${plan.price}</strong><small>${t("tokens")}</small></span>
      </button>
    `;
  }).join("");

  return frame(`
    <section class="scroll-area plans-screen">
      ${topBar({ title: t("choosePlan"), subtitle: t("planSubtitle"), compact: true })}
      <div class="plan-list">${cards}</div>
      <div class="trust-list">
        <div>${icon("shield")}<strong>${t("trustPlan")}</strong></div>
        <div>${icon("wallet")}<strong>${t("guarantee")}</strong></div>
      </div>
    </section>
    <footer class="sticky-action">
      <button class="primary-cta" type="button" data-action="continue-plan">${t("continue")}</button>
    </footer>
  `, { className: "no-nav" });
}

function renderHome() {
  const filtered = shops.filter((shop) => {
    const needle = state.search.trim().toLowerCase();
    return !needle || `${shop.name} ${shop.district} ${shop.address}`.toLowerCase().includes(needle);
  });
  const featured = filtered.length ? filtered.map(renderShopCard).join("") : `<div class="empty-card">${t("noResults")}</div>`;

  return frame(`
    <section class="scroll-area home-screen">
      ${topBar()}
      <section class="hero-card">
        <img src="${imagePath}" alt="A red car being washed at a modern car wash bay">
        <div class="hero-overlay">
          <h1>${t("heroTitle")}</h1>
          <p>${t("heroCopy")}</p>
        </div>
      </section>

      <label class="search-field">
        ${icon("search")}
        <input id="searchInput" type="search" value="${escapeHtml(state.search)}" placeholder="${t("searchPlaceholder")}" autocomplete="off">
        <span>${icon("filter")}</span>
      </label>

      <div class="section-heading">
        <h2>${t("recommended")}</h2>
        <span class="token-pill">${icon("coins")}${state.tokens} ${t("tokenShort")}</span>
      </div>
      ${renderMap()}
      <div class="shop-carousel">${featured}</div>

      <div class="section-heading">
        <h2>${t("services")}</h2>
      </div>
      <div class="service-grid">
        ${services.map((service) => renderServiceTile(service)).join("")}
        <button class="service-tile" type="button" data-action="noop">${icon("filter")}<span>${t("moreServices")}</span></button>
      </div>

      <section class="promo-card">
        <div>
          <h2>${t("promoTitle")}</h2>
          <p>${t("promoCopy")}</p>
        </div>
        <div class="promo-visual">${icon("car")}</div>
      </section>
      ${renderQuickSheet()}
    </section>
  `, { nav: "home" });
}

function renderMap() {
  return `
    <button class="map-preview" type="button" data-action="screen" data-screen="home" aria-label="Nearby Washgo locations">
      <span class="map-road road-a"></span>
      <span class="map-road road-b"></span>
      <span class="map-road road-c"></span>
      <span class="map-label">Thảo Điền</span>
      <span class="map-label label-b">Bình Thạnh</span>
      <span class="map-label label-c">An Khánh</span>
      <span class="user-marker">${icon("location")}</span>
      <span class="wash-pin pin-a">${icon("car")}</span>
      <span class="wash-pin pin-b">${icon("car")}</span>
      <span class="wash-pin pin-c">${icon("car")}</span>
    </button>
  `;
}

function renderShopCard(shop) {
  return `
    <article class="shop-card">
      <button class="shop-media ${shop.imageClass}" type="button" data-action="select-shop" data-shop="${shop.id}">
        <img src="${imagePath}" alt="${shop.name} wash bay">
        <span class="deal-badge">${t("freeWash")}</span>
      </button>
      <div class="shop-body">
        <div class="shop-title-row">
          <button class="shop-title" type="button" data-action="select-shop" data-shop="${shop.id}">${shop.name}</button>
          <button class="icon-button subtle" type="button" data-action="quick-view" data-shop="${shop.id}" aria-label="${t("quickView")}">${icon("heart")}</button>
        </div>
        <p><span class="status">${t("open")}</span> · ${t("hours")} · ${shop.distance}</p>
        <div class="shop-meta">
          <span>${icon("star")} ${shop.rating} (${shop.reviews})</span>
          <span>${icon("clock")} ${shop.wait}</span>
          <strong>${shop.starting} ${t("tokenShort")}</strong>
        </div>
        <div class="shop-services">
          ${shop.services.map((id) => `<span>${serviceName(id)}</span>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderServiceTile(service) {
  return `
    <button class="service-tile" type="button" data-action="service-filter" data-service="${service.id}">
      ${icon(service.icon)}
      <span>${serviceName(service.id)}</span>
    </button>
  `;
}

function renderQuickSheet() {
  const shop = shops.find((item) => item.id === state.quickShop);
  if (!shop) return "";
  return `
    <div class="overlay-sheet" role="dialog" aria-modal="true" aria-label="${shop.name}">
      <div class="sheet-card">
        <div class="sheet-handle"></div>
        ${renderShopCard(shop)}
        <div class="sheet-actions">
          <button class="secondary-cta" type="button" data-action="close-quick">${t("close")}</button>
          <button class="primary-cta" type="button" data-action="select-shop" data-shop="${shop.id}">${t("bookNow")}</button>
        </div>
      </div>
    </div>
  `;
}

function renderDetail() {
  const shop = currentShop();
  return frame(`
    <section class="detail-screen">
      <div class="detail-map">
        ${renderMap()}
        <button class="icon-button floating-back" type="button" data-action="screen" data-screen="home" aria-label="Back">${icon("arrowLeft")}</button>
      </div>
      <div class="detail-sheet">
        <div class="detail-title">
          <div>
            <h1>${shop.name}</h1>
            <p>${t("hours")} · ${shop.distance}</p>
            <p>${icon("location")} ${shop.address}</p>
          </div>
          <div class="detail-actions">
            <button class="icon-button subtle" type="button" data-action="noop" aria-label="Share">${icon("share")}</button>
            <button class="icon-button subtle" type="button" data-action="quick-view" data-shop="${shop.id}" aria-label="Favorite">${icon("heart")}</button>
          </div>
        </div>
        <img class="detail-image" src="${imagePath}" alt="${shop.name}">
        <h2>${t("serviceIncluded")}</h2>
        <div class="chip-row">${shop.services.map((id) => `<span>${icon(services.find((service) => service.id === id)?.icon || "car")}${serviceName(id)}</span>`).join("")}</div>
        <button class="show-more" type="button" data-action="screen" data-screen="booking">${t("showMore")}</button>
      </div>
    </section>
    <footer class="price-footer">
      <div><strong>${shop.starting}</strong><span>${t("tokens")}<br>${t("startingAt")}</span></div>
      <button class="primary-cta" type="button" data-action="screen" data-screen="booking">${t("bookNow")}</button>
    </footer>
  `, { className: "detail-frame" });
}

function renderBooking() {
  const timeCards = times.map((time) => `
    <button class="time-chip ${state.selectedTime === time ? "is-selected" : ""}" type="button" data-action="select-time" data-time="${time}">${time}</button>
  `).join("");

  const serviceRows = services.map((service) => {
    const selected = state.selectedServices.has(service.id);
    return `
      <button class="booking-service ${selected ? "is-selected" : ""}" type="button" data-action="toggle-service" data-service="${service.id}" aria-pressed="${selected}">
        <span>${icon(service.icon)}<strong>${serviceName(service.id)}</strong></span>
        <span>${service.token} ${t("tokenShort")} · ${selected ? t("selected") : t("add")}</span>
      </button>
    `;
  }).join("");

  return frame(`
    <section class="scroll-area booking-screen">
      ${topBar({ back: { action: "screen", screen: "detail" }, title: `${t("bookNow")}`, subtitle: currentShop().name, compact: true })}
      ${renderCalendarPicker()}
      <section class="form-card">
        <h2>${t("selectTime")}</h2>
        <div class="time-grid">${timeCards}</div>
      </section>
      <section class="form-card">
        <div class="form-head">
          <div>
            <h2>${t("chooseServices")}</h2>
            <p>${t("serviceHint")}</p>
          </div>
        </div>
        <div class="service-stack">${serviceRows}</div>
      </section>
      ${renderBookingSummaryCard()}
      <section class="form-card">
        <h2>${t("vehicleDetails")}</h2>
        <label class="field">
          <span>${t("licensePlate")}</span>
          <input id="plateInput" type="text" value="${escapeHtml(state.vehicle.plate)}" autocomplete="off">
        </label>
        <label class="field">
          <span>${t("notes")}</span>
          <textarea id="notesInput" placeholder="${t("notesPlaceholder")}">${escapeHtml(state.vehicle.notes)}</textarea>
        </label>
      </section>
      ${renderSummary()}
    </section>
    <footer class="confirm-footer">
      <button class="primary-cta split-cta" type="button" data-action="confirm-booking" ${total() === 0 ? "disabled" : ""}>
        ${icon("calendar")}
        <span><strong>${t("confirmBooking")}</strong><small>${selectedDateLabel()}, ${state.selectedTime}</small></span>
        ${icon("arrowLeft", "arrow-next")}
      </button>
    </footer>
  `);
}

function renderCalendarPicker() {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [
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

  return `
    <section class="form-card date-picker-card">
      <h2>${t("selectDate")}</h2>
      <div class="calendar-head">
        <button class="calendar-nav" type="button" data-action="noop" aria-label="Previous month">${icon("arrowLeft")}</button>
        <strong>${t("monthMay2026")}</strong>
        <button class="calendar-nav next" type="button" data-action="noop" aria-label="Next month">${icon("arrowLeft")}</button>
      </div>
      <div class="calendar-grid" aria-label="${t("selectDate")}">
        ${weekdays.map((day) => `<span class="weekday">${day}</span>`).join("")}
        ${days.map((item) => {
          const selected = item.id && state.selectedDate === item.id;
          const attrs = item.id ? `data-action="select-date" data-date="${item.id}"` : `data-action="noop"`;
          return `<button class="calendar-day ${item.muted ? "is-muted" : ""} ${selected ? "is-selected" : ""}" type="button" ${attrs}>${item.day}</button>`;
        }).join("")}
      </div>
      <div class="advance-deal">${icon("gift")}<span>${t("advanceDeal")}</span></div>
    </section>
  `;
}

function selectedDateLabel() {
  const date = dates.find((item) => item.id === state.selectedDate) || dates[0];
  return `${t(date.label)} ${date.number} ${date.sub}`;
}

function renderBookingSummaryCard() {
  return `
    <section class="booking-summary-card">
      <img src="${imagePath}" alt="${currentShop().name}">
      <div>
        <small>${t("serviceSummary")}</small>
        <h2>${currentShop().name} ${icon("shield")}</h2>
        <p>${selectedServices().map((service) => serviceName(service.id)).join(" · ")}</p>
        <strong>${subtotal()} ${t("tokens")}</strong>
      </div>
    </section>
  `;
}

function renderSummary() {
  const lines = selectedServices().map((service) => `
    <div class="summary-line"><span>${serviceName(service.id)}</span><strong>${service.token}</strong></div>
  `).join("");
  return `
    <section class="summary-card">
      <h2>${t("tokenDetails")}</h2>
      ${lines}
      ${discount() ? `<div class="summary-line discount"><span>${t("discount")}</span><strong>-${discount()}</strong></div>` : ""}
      <div class="summary-line total"><span>${t("total")}</span><strong>${total()}</strong></div>
    </section>
  `;
}

function renderConfirmation() {
  return frame(`
    <section class="scroll-area confirmation-screen">
      <div class="success-mark">${icon("check")}</div>
      <h1>${t("confirmedTitle")}</h1>
      <p>${t("confirmedCopy")}</p>
      ${state.booking ? renderBookingCard() : ""}
      ${renderRewardsCard()}
      <div class="dual-actions">
        <button class="secondary-cta" type="button" data-action="screen" data-screen="rewards">${t("viewRewards")}</button>
        <button class="primary-cta" type="button" data-action="screen" data-screen="home">${t("bookAnother")}</button>
      </div>
    </section>
  `);
}

function renderBookings() {
  return frame(`
    <section class="scroll-area bookings-screen">
      ${topBar({ title: t("bookings"), compact: true })}
      ${state.booking ? renderBookingCard() : `<div class="empty-card">${t("noBookings")}</div>`}
    </section>
  `, { nav: "bookings" });
}

function renderBookingCard() {
  return `
    <article class="booking-card">
      <img src="${imagePath}" alt="${currentShop().name}">
      <div>
        <h2>${state.booking.shop}</h2>
        <p>${state.booking.date} · ${state.booking.time}</p>
        <strong>${state.booking.total} ${t("tokens")}</strong>
      </div>
    </article>
  `;
}

function renderRewards() {
  return frame(`
    <section class="scroll-area rewards-screen">
      ${topBar({ title: t("rewardsTitle"), subtitle: t("rewardsCopy"), compact: true })}
      ${renderRewardsCard()}
      ${renderVoucherAccess()}
    </section>
  `, { nav: "rewards" });
}

function renderAccount() {
  return frame(`
    <section class="scroll-area account-screen">
      ${topBar({ title: t("account"), compact: true })}
      <div class="profile-head">
        <div class="avatar"><img src="${profileImagePath}" alt="${t("profileName")}"></div>
        <div>
          <h1>${t("profileName")}</h1>
          <p>${t("memberSince")}</p>
        </div>
      </div>
      <section class="member-card">
        <h2>${state.selectedPlan === "premium" ? t("premium") : t("basic")} Member</h2>
        <p>${t("memberUntil")}<br><strong>${t("dateUntil")}</strong></p>
      </section>
      <section class="token-panel">
        <div><span>${t("myTokens")}</span><strong>${state.tokens}</strong></div>
        <button class="small-cta" type="button" data-action="screen" data-screen="plans">${t("upgradePlan")}</button>
      </section>
      ${renderVoucherAccess()}
      ${renderRewardsCard()}
      <button class="secondary-cta" type="button" data-action="reset-demo">${t("resetDemo")}</button>
    </section>
  `, { nav: "account" });
}

function renderVouchers() {
  const vouchers = currentVouchers();
  return frame(`
    <section class="scroll-area vouchers-screen">
      ${topBar({ title: t("currentVouchers"), subtitle: `${vouchers.length} ${t("voucherCount")}`, compact: true })}
      <div class="voucher-list">
        ${vouchers.map(renderCurrentVoucher).join("")}
      </div>
    </section>
  `, { nav: "rewards" });
}

function currentVouchers() {
  const vouchers = [
    {
      id: "detailing10",
      title: t("discountVoucherTitle"),
      copy: t("discountVoucherCopy"),
      code: "DETAIL10",
      expires: "20 Jul 2026",
      tone: "red"
    }
  ];

  if (state.voucher) {
    vouchers.unshift({
      id: "freewash",
      title: t("voucherTitle"),
      copy: t("voucherCopy"),
      code: "WASHGO-FREE-01",
      expires: "31 Aug 2026",
      tone: "green"
    });
  }

  return vouchers;
}

function renderVoucherAccess() {
  const vouchers = currentVouchers();
  return `
    <button class="voucher-access" type="button" data-action="screen" data-screen="vouchers">
      <span>${icon("gift")}</span>
      <span>
        <strong>${t("currentVouchers")}</strong>
        <small>${vouchers.length} ${t("voucherCount")}</small>
      </span>
      ${icon("arrowLeft", "arrow-next")}
    </button>
  `;
}

function renderCurrentVoucher(voucher) {
  return `
    <article class="current-voucher ${voucher.tone === "green" ? "is-green" : ""}">
      <div class="current-voucher-icon">${icon(voucher.id === "freewash" ? "car" : "gift")}</div>
      <div>
        <h2>${voucher.title}</h2>
        <p>${voucher.copy}</p>
      </div>
      <div class="voucher-code-row">
        <span>${t("code")}: <strong>${voucher.code}</strong></span>
        <span>${t("expires")}: <strong>${voucher.expires}</strong></span>
      </div>
      <button class="small-cta" type="button" data-action="screen" data-screen="home">${t("useNow")}</button>
    </article>
  `;
}

function renderRewardsCard() {
  const stamps = Array.from({ length: 5 }, (_, index) => `
    <span class="stamp ${index < state.stamps ? "is-filled" : ""}">${icon("car")}</span>
  `).join("");
  return `
    <section class="reward-card">
      <div>
        <h2>${t("rewardsTitle")}</h2>
        <p>${t("rewardsCopy")}</p>
      </div>
      <div class="stamp-track">${stamps}</div>
      <p class="reward-progress"><strong>${state.stamps}</strong> / 5 ${t("washesCompleted")}</p>
      ${state.voucher ? renderVoucher() : `<p class="voucher-note">${t("voucherLocked")}</p>`}
    </section>
  `;
}

function renderVoucher() {
  return `
    <article class="voucher-card">
      <div>${icon("gift")}</div>
      <span>${t("freeWash")}</span>
      <h2>${t("voucherTitle")}</h2>
      <p>${state.voucher ? t("voucherCopy") : t("voucherLocked")}</p>
      <button class="small-cta" type="button" data-action="screen" data-screen="home">${state.voucher ? t("useVoucher") : t("bookNow")}</button>
    </article>
  `;
}

function renderNav(active) {
  const items = [
    ["home", "home", t("home")],
    ["bookings", "calendar", t("bookings")],
    ["rewards", "gift", t("rewards")],
    ["account", "user", t("account")]
  ];
  return `
    <nav class="bottom-nav" aria-label="Primary navigation">
      ${items.map(([screen, iconName, label]) => `
        <button class="nav-button ${active === screen ? "is-active" : ""}" type="button" data-action="screen" data-screen="${screen}" aria-label="${label}">
          ${icon(iconName)}
          <span>${label}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function wireInputs() {
  const searchInput = document.querySelector("#searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.search = event.target.value;
      render();
      const next = document.querySelector("#searchInput");
      if (next) {
        next.focus();
        next.setSelectionRange(state.search.length, state.search.length);
      }
    });
  }

  const plateInput = document.querySelector("#plateInput");
  if (plateInput) {
    plateInput.addEventListener("input", (event) => {
      state.vehicle.plate = event.target.value;
    });
  }

  const notesInput = document.querySelector("#notesInput");
  if (notesInput) {
    notesInput.addEventListener("input", (event) => {
      state.vehicle.notes = event.target.value;
    });
  }
}

function confirmBooking() {
  if (!total()) return;
  state.tokens = Math.max(0, state.tokens - total());
  state.stamps = Math.min(5, state.stamps + 1);
  state.voucher = state.stamps >= 5;
  state.booking = {
    shop: currentShop().name,
    date: selectedDateLabel(),
    time: state.selectedTime,
    total: total()
  };
  state.screen = "confirmation";
  state.quickShop = null;
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function resetDemo() {
  state.lang = "en";
  state.screen = "plans";
  state.selectedPlan = "premium";
  state.tokens = 0;
  state.stamps = 4;
  state.voucher = false;
  state.booking = null;
  state.selectedShop = "sparkle";
  state.selectedServices = new Set(["exterior", "interior"]);
  state.selectedDate = "today";
  state.selectedTime = "12.00PM";
  state.search = "";
  state.quickShop = null;
  state.vehicle = { plate: "51G-248.19", notes: "" };
  render();
}

document.addEventListener("click", (event) => {
  const langButton = event.target.closest("[data-lang]");
  if (langButton) {
    state.lang = langButton.dataset.lang;
    render();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "select-plan") {
    state.selectedPlan = target.dataset.plan;
    render();
  }

  if (action === "continue-plan") {
    state.tokens = currentPlan().tokens;
    state.screen = "home";
    render();
  }

  if (action === "screen") {
    state.screen = target.dataset.screen;
    state.quickShop = null;
    render();
  }

  if (action === "brand-home") {
    state.screen = state.tokens > 0 ? "home" : "plans";
    render();
  }

  if (action === "select-shop") {
    state.selectedShop = target.dataset.shop;
    state.screen = "detail";
    state.quickShop = null;
    render();
  }

  if (action === "quick-view") {
    state.quickShop = target.dataset.shop;
    render();
  }

  if (action === "close-quick") {
    state.quickShop = null;
    render();
  }

  if (action === "service-filter") {
    const shop = shops.find((item) => item.services.includes(target.dataset.service));
    if (shop) {
      state.selectedShop = shop.id;
      state.screen = "detail";
      render();
    }
  }

  if (action === "select-date") {
    state.selectedDate = target.dataset.date;
    render();
  }

  if (action === "select-time") {
    state.selectedTime = target.dataset.time;
    render();
  }

  if (action === "toggle-service") {
    const id = target.dataset.service;
    if (state.selectedServices.has(id)) {
      state.selectedServices.delete(id);
    } else {
      state.selectedServices.add(id);
    }
    render();
  }

  if (action === "confirm-booking") {
    confirmBooking();
  }

  if (action === "reset-demo") {
    resetDemo();
  }
});

render();
