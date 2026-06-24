-- 0020 DIRECTORY LISTINGS — seed real HCMC car washes as info-only map pins.
-- These businesses have NOT partnered with Washgo yet, so they are discovery-only:
-- they appear on the map with details (rating, hours, phone, notes) but cannot be
-- booked or paid for. A `listing_type` discriminator separates them from real
-- bookable 'partner' shops; booking RPCs reject anything that isn't 'partner'.
--
-- LONG-TERM (onboarding): a directory listing is claimable. When the real owner
-- joins (existing apply_for_owner -> admin-approved owner role), they claim their
-- listing (claim_listing); an admin approves (approve_listing_claim), which sets
-- owner_id, flips listing_type to 'partner', and unpublishes it so the new owner
-- can configure hours/services/capacity before releasing it publicly themselves.

-- 1) Discriminator + directory-only fields. listing_type/notes/claimed_by are
--    deliberately NOT in the owner column grants (clients can't self-assign them).
alter table public.shops add column if not exists listing_type text not null default 'partner'
  check (listing_type in ('partner','directory'));
alter table public.shops add column if not exists notes text;
alter table public.shops add column if not exists claimed_by uuid references auth.users(id) on delete set null;

create index if not exists shops_listing_type_idx on public.shops(listing_type);

-- 2) Seed the directory rows. owner_id NULL, status approved + published so they
--    pass the public catalog filter and show on the map immediately. Idempotent.
insert into public.shops
  (id, owner_id, name, district, address, phone, rating, reviews_count, hours,
   lat, lng, is_open, status, published, listing_type, notes, starting_price)
values
  ('vinawash-district-7', null, 'VinaWash - District 7', 'District 7', '84 Cù Lao, Cầu Kiệu', '+84 988 579 068', 4.2, 71, 'Daily 7AM-6PM', 10.7967566, 106.6878482, true, 'approved', true, 'directory', null, null),
  ('washzone-by-rinrin', null, 'Washzone By Rinrin', 'District 10', '332 Tô Hiến Thành, Diên Hồng', '+84 794 101 101', 4.9, 161, 'Daily ~7AM-11PM', 10.7760477, 106.6631753, true, 'approved', true, 'directory', null, null),
  ('vinawash-quan-9', null, 'VinaWash quận 9', 'Thủ Đức (Q9)', '77 Đỗ Xuân Hợp, Phước Long', '+84 988 579 068', 4.7, 123, 'Daily 7AM-6PM', 10.8319576, 106.7675986, true, 'approved', true, 'directory', null, null),
  ('aerowash', null, 'Aerowash', 'Thủ Đức (Q2)', '84 Trần Não, An Khánh', '+84 797 772 458', 4.5, 191, 'Daily 8AM-5PM', 10.7946953, 106.7307967, true, 'approved', true, 'directory', 'Luxury/detailing focus', null),
  ('car-wash-centre', null, 'Car Wash Centre', 'District 7', '1A Đ. Phú Thuận, Phú Thuận', '+84 784 767 679', 4.5, 16, 'Daily 8AM-6PM', 10.7315266, 106.7390595, true, 'approved', true, 'directory', null, null),
  ('vietnam-car-care', null, 'Vietnam Car Care', 'District 7', '1A Đ. Phú Thuận, Phú Thuận', '+84 911 811 247', 4.9, 258, 'Daily 8AM-5:30PM', 10.7315563, 106.7390514, true, 'approved', true, 'directory', 'Detailing, PPF, ceramic', null),
  ('thang-bom-2-auto-care-car-wash', null, 'Thằng Bờm 2 Auto Care & Car Wash', 'Gò Vấp', '294 Nguyễn Thái Sơn, Hạnh Thông', '+84 796 329 579', 4, 35, 'Daily 7:30AM-7PM', 10.8220144, 106.6850704, true, 'approved', true, 'directory', null, null),
  ('washup-car-wash-detailing', null, 'WashUp Car Wash & Detailing', 'District 7', 'Phú Mỹ Hưng, Tân Hưng', '+84 399 639 639', 4.4, 67, 'Daily 8AM-6PM', 10.7243836, 106.7100906, true, 'approved', true, 'directory', null, null),
  ('vinawash-tan-phu', null, 'VinaWash - Tân Phú', 'Tân Phú', '87 Tân Thắng, Tân Sơn Nhì', '+84 988 579 068', 4.7, 358, 'Daily 7AM-6PM', 10.8034162, 106.6229133, true, 'approved', true, 'directory', null, null),
  ('rua-xe-minh-uc', null, 'Rửa Xe Minh Đức', 'Bình Thạnh', '16 Ngô Đức Kế', '+84 28 6653 0970', 4.8, 16, 'Daily 8AM-6PM', 10.8083044, 106.6977757, true, 'approved', true, 'directory', null, null),
  ('tt-cham-soc-xe-o-to-chu-van-an', null, 'TT Chăm Sóc Xe Ô Tô Chu Văn An', 'Bình Thạnh', '1c Chu Văn An', null, 2.3, 9, 'Daily 6AM-9PM', 10.8103413, 106.7075168, true, 'approved', true, 'directory', 'Low rating', null),
  ('mt-detailing-binh-thanh', null, 'MT - Detailing Bình Thạnh', 'Bình Thạnh', '538 Nơ Trang Long', '+84 918 186 607', 3, 6, 'Varies', 10.8232652, 106.7071898, true, 'approved', true, 'directory', null, null),
  ('rua-xe-bi', null, 'Rửa Xe Bi', 'Bình Thạnh', '3 Nguyễn Huy Lượng', null, 3.6, 85, 'Daily 8AM-5PM', 10.8057929, 106.6972812, true, 'approved', true, 'directory', null, null),
  ('rua-xe-redsun', null, 'Rửa Xe Redsun', 'Bình Thạnh', '69/1/32 Nguyễn Gia Trí', '+84 866 040 458', 4.6, 51, 'Tue-Sun 9:30AM-9:30PM', 10.8032454, 106.714414, true, 'approved', true, 'directory', null, null),
  ('4car-workshop', null, '4Car Workshop', 'Bình Thạnh', '351 Bình Lợi', '+84 907 412 666', 4.9, 7, 'Daily 8AM-6PM', 10.8353425, 106.7027565, true, 'approved', true, 'directory', null, null),
  ('prime-shine-detailing', null, 'Prime Shine Detailing', 'Tân Bình', 'C12, Tân Bình', '+84 909 859 826', 4.9, 84, 'Daily 7AM-11:30PM', 10.8099375, 106.6454375, true, 'approved', true, 'directory', 'Near airport', null),
  ('wash-master', null, 'Wash Master', 'Tân Bình', '1226 Lạc Long Quân, Tân Hòa', '+84 769 637 528', 4.4, 59, 'Daily 8:30AM-7PM', 10.7878678, 106.6517326, true, 'approved', true, 'directory', 'English-speaking staff', null),
  ('gara-qk-car-spa', null, 'GARA QK Car Spa', 'Tân Bình', '452 Trường Chinh', '+84 938 326 236', 3.7, 10, 'Daily 8:30AM-6PM', 10.8007206, 106.6389837, true, 'approved', true, 'directory', null, null),
  ('rua-xe-may-16-c1', null, 'Rửa Xe Máy (16 C1)', 'Tân Bình', '16 C1, Tân Bình', '+84 388 275 905', 3.9, 52, 'Daily 7AM-7PM', 10.8029426, 106.6458603, true, 'approved', true, 'directory', null, null),
  ('akauto-cham-soc-phu-kien-o-to', null, 'AKauto - Chăm Sóc & Phụ Kiện Ô Tô', 'Tân Bình', '678 Trường Chinh', '+84 903 939 683', 4.6, 345, 'Daily 8AM-7PM', 10.805954, 106.6353297, true, 'approved', true, 'directory', null, null),
  ('bin-car-wash', null, 'Bin Car Wash', 'Thủ Đức', '421b Nguyễn Văn Bá', '+84 966 035 573', 4.3, 23, 'Daily 7AM-9PM', 10.8329085, 106.7637188, true, 'approved', true, 'directory', null, null),
  ('rua-xe-thu-uc-pkw', null, 'Rửa xe Thủ Đức PKW', 'Thủ Đức', '6 Bác Ái', '+84 939 700 770', 4.7, 80, 'Daily 8AM-5:30PM (lunch break)', 10.843685, 106.7648782, true, 'approved', true, 'directory', null, null),
  ('tai-loi-car', null, 'Tài Lợi Car', 'Thủ Đức', '700 QL13, KP4', '+84 399 990 139', 5, 1, 'Open 24 hours', 10.8571069, 106.7251141, true, 'approved', true, 'directory', null, null),
  ('alpha-auto-care', null, 'Alpha Auto Care', 'Thủ Đức', '169 Đ. Số 11, KP3', '+84 909 797 048', 5, 2, 'Daily 7AM-6PM', 10.8374021, 106.7515208, true, 'approved', true, 'directory', null, null),
  ('ruby-detailing-thu-uc', null, 'Ruby Detailing Thủ Đức', 'Thủ Đức', '47A Đ. Số 3', '+84 947 392 233', 4.6, 12, 'Daily 8:30AM-5:30PM', 10.8344065, 106.7598276, true, 'approved', true, 'directory', null, null),
  ('super-car-care', null, 'Super Car Care', 'Thủ Đức', '421b Nguyễn Văn Bá', '+84 767 777 739', 4.3, 18, 'Daily 7AM-7PM', 10.8329085, 106.7637188, true, 'approved', true, 'directory', null, null),
  ('tt-rua-xe-hct-college-of-tech', null, 'TT Rửa Xe HCT (College of Tech)', 'Thủ Đức', '586 Kha Vạn Cân', '+84 778 677 236', 5, 7, 'Daily 9AM-5PM', 10.8398241, 106.745044, true, 'approved', true, 'directory', null, null),
  ('rua-xe-192-phu-nhuan', null, 'Rửa Xe 192 - Phú Nhuận', 'Phú Nhuận', '82 Cù Lao, Cầu Kiệu', '+84 28 3843 6145', 3.7, 132, 'Daily 6AM-6PM', 10.7967599, 106.6878546, true, 'approved', true, 'directory', null, null),
  ('ngoc-nghia-car-care', null, 'Ngọc Nghĩa Car Care', 'Phú Nhuận', '231/7a Lê Văn Sỹ', '+84 902 195 979', 0, 0, 'Mon-Sat 8AM-5PM', 10.7928372, 106.6693361, true, 'approved', true, 'directory', null, null),
  ('d-superwash', null, 'D Superwash', 'Phú Nhuận', '3 Đ. Đặng Văn Sâm', '+84 896 321 056', 5, 2, 'Daily 6:30AM-7PM', 10.8093526, 106.6774624, true, 'approved', true, 'directory', null, null),
  ('car-and-motorcycle-detailing', null, 'Car and Motorcycle Detailing', 'Phú Nhuận', '90A Nguyễn Trọng Tuyển', '+84 775 035 662', 5, 1, 'Daily until 8PM', 10.7974317, 106.6789326, true, 'approved', true, 'directory', null, null),
  ('40-phan-tay-ho', null, '40 Phan Tây Hồ', 'Phú Nhuận', '40 Phan Tây Hồ, Cầu Kiệu', null, 4.5, 8, 'Daily 6AM-5PM', 10.8019583, 106.6867367, true, 'approved', true, 'directory', 'Small alley shop', null),
  ('diamond-car-care-detailing', null, 'Diamond Car Care - Detailing', 'Tân Bình', '18E/14 Cộng Hòa', '+84 907 223 186', 4.9, 65, 'Daily ~8AM-5:30PM', 10.8075407, 106.6552557, true, 'approved', true, 'directory', null, null),
  ('vicare-detailing', null, 'Vicare Detailing', 'Tân Phú', 'Celadon City, Tân Sơn Nhì', '+84 915 555 086', 5, 32, 'Daily 8:30AM-6PM', 10.803578, 106.6138874, true, 'approved', true, 'directory', null, null),
  ('ap-car-care', null, 'AP Car Care', 'Tân Phú', '2 Lê Lư, Phú Thọ Hòa', '+84 28 7777 2526', 5, 641, 'Daily 8AM-6PM', 10.7847127, 106.6242844, true, 'approved', true, 'directory', 'Highest review count', null),
  ('98-car-detailing', null, '98 Car Detailing', 'District 12', '159/1 Tô Ngọc Vân, Thới An', '+84 968 526 883', 5, 6, 'Daily 7:30AM-10PM', 10.8597628, 106.6682604, true, 'approved', true, 'directory', 'New (2025)', null),
  ('anh-duong-detailing', null, 'Ánh Dương Detailing', 'District 8', '2A-2B Hoàng Kim Giao, Chánh Hưng', '+84 961 897 589', 4.8, 129, 'Daily 7:30AM-5:30PM', 10.737952, 106.669702, true, 'approved', true, 'directory', 'Ceramic coating', null),
  ('sg-auto-detailing', null, 'SG Auto Detailing', 'Gò Vấp', '23/50 Số 21, Thông Tây Hội', '+84 909 124 418', 4.9, 39, 'Open 24 hours', 10.8406681, 106.6487225, true, 'approved', true, 'directory', null, null),
  ('phuoc-thanh-car-wash', null, 'Phuoc Thanh Car Wash', 'District 10', '373-375 CMT8, Hòa Hưng', '+84 28 3862 6266', 0, 0, 'Varies', 10.7797218, 106.6771968, true, 'approved', true, 'directory', null, null),
  ('rua-xe-ky-hoa', null, 'Rửa xe Kỳ Hòa', 'District 10', '197 Cao Thắng, Hòa Hưng', '+84 903 644 571', 3.7, 85, 'Daily 6:30AM-5PM', 10.7747747, 106.6726302, true, 'approved', true, 'directory', 'Cars + bikes', null),
  ('auto-care-68', null, 'Auto Care 68', 'Bình Tân', '50a Tây Lân', '+84 975 135 316', 5, 5, 'Daily 7:30AM-5PM', 10.7715679, 106.5869411, true, 'approved', true, 'directory', null, null),
  ('qt-car-care', null, 'QT Car Care', 'Bình Tân', '694 Tân Kỳ Tân Quý, Bình Hưng Hòa', '+84 767 664 756', 5, 46, 'Varies', 10.7923541, 106.6061174, true, 'approved', true, 'directory', 'Engine bay cleaning', null),
  ('gara-a8', null, 'Gara A8', 'Bình Tân', 'Đ. A8, KP5', '+84 943 119 678', 5, 2, 'Daily 6AM-11:30PM', 10.804915, 106.590983, true, 'approved', true, 'directory', null, null),
  ('auto-alacar-care', null, 'Auto Alacar Care', 'Bình Tân', '139 Bình Thành, KP5', '+84 908 639 896', 5, 4, 'Open 24 hours', 10.8043976, 106.5878007, true, 'approved', true, 'directory', null, null),
  ('ken-detailing-coffee-24-7', null, 'Ken Detailing & Coffee 24/7', 'Gò Vấp', '710/2/25 Phan Văn Trị', '+84 568 939 939', 4.7, 27, 'Open 24 hours', 10.8354629, 106.6665773, true, 'approved', true, 'directory', 'Detailing + cafe', null),
  ('king-car-care', null, 'King Car Care', 'Gò Vấp', '241 Hẻm 2 Lê Đức Thọ, Hạnh Thông', '+84 979 626 263', 5, 2, 'Daily 9AM-6PM', 10.8312798, 106.6830018, true, 'approved', true, 'directory', null, null),
  ('anh-thang-service', null, 'Anh Thắng Service', 'Gò Vấp', '3 Đ. Số 4, Hạnh Thông', '+84 976 091 068', 4.4, 47, 'Daily 7AM-10PM', 10.8322605, 106.6829803, true, 'approved', true, 'directory', null, null),
  ('rua-xe-77', null, 'Rửa xe 77', 'Gò Vấp', '152 Nguyễn Oanh', '+84 812 431 173', 4.2, 62, 'Daily 6AM-10PM', 10.8313298, 106.6774674, true, 'approved', true, 'directory', null, null),
  ('rua-xe-vietwash-21', null, 'Rửa xe VietWash 21', 'Gò Vấp', '4/34 Nguyễn Oanh', '+84 28 3517 0157', 2.5, 60, 'Daily 7AM-7PM', 10.8392705, 106.6756057, true, 'approved', true, 'directory', 'Low rating', null),
  ('nhat-minh-car-care-nm-car', null, 'Nhật Minh Car Care (NM Car)', 'Bình Chánh', '10/26 Đoàn Nguyễn Tuấn', '+84 906 611 946', 4.6, 17, 'Daily 8AM-6PM', 10.6660372, 106.5923989, true, 'approved', true, 'directory', null, null),
  ('rua-xe-tu-my', null, 'Rửa Xe Tú Mỹ', 'Bình Chánh', 'E1/3A KP13, Tân Nhựt', '+84 946 903 551', 4.7, 14, 'Daily 7AM-6PM', 10.6921811, 106.5816216, true, 'approved', true, 'directory', 'Parking too', null),
  ('thuan-phong-auto', null, 'Thuận Phong Auto', 'Bình Chánh', '1 Đ. Xóm Dầu, Tân Nhựt', '+84 375 434 868', 5, 4, 'Daily 7AM-6PM', 10.6825756, 106.5764689, true, 'approved', true, 'directory', 'Monthly parking', null),
  ('green-wash-auto', null, 'Green Wash Auto', 'District 6', '378 Đ. Chợ Lớn, Bình Phú', '+84 966 784 479', 4.4, 9, 'Daily 7:30AM-6PM', 10.7445869, 106.6260427, true, 'approved', true, 'directory', 'Issues invoices', null),
  ('hth-nha-be-car', null, 'HTH Nha Be Car', 'Nhà Bè', '30/6 Huỳnh Thị Đồng', '+84 982 150 000', 4.8, 16, 'Daily 6:30AM-5:30PM', 10.6968328, 106.7420456, true, 'approved', true, 'directory', 'Cafe, inspection support', null),
  ('hm8x-car-wash', null, 'HM8x Car Wash', 'Nhà Bè', '317 Phạm Hữu Lầu', null, 5, 3, 'Varies', 10.7023688, 106.7216082, true, 'approved', true, 'directory', null, null),
  ('rua-xe-phong-vu-carwash-coffee', null, 'Rửa Xe Phong Vũ - Carwash & Coffee', 'Nhà Bè', '12 Trần Thị Liền', null, 4.8, 27, 'Open 24 hours', 10.709684, 106.7033628, true, 'approved', true, 'directory', 'Cars + bikes, cafe', null),
  ('trung-toan-wash', null, 'Trung Toán Wash', 'Nhà Bè', 'C28 Sunrise Riverside', '+84 966 790 848', 3.1, 9, 'Daily 7AM-6:30PM', 10.7232118, 106.7052119, true, 'approved', true, 'directory', null, null),
  ('rua-xe-cafe-nha-be', null, 'Rửa Xe Cafe Nhà Bè', 'Nhà Bè', '30/20 Huỳnh Thị Đồng, KP10', '+84 943 620 000', 5, 1, 'Open 24 hours', 10.6968867, 106.7410704, true, 'approved', true, 'directory', null, null),
  ('rua-xe-binh-carwash', null, 'Rửa xe Bình Carwash', 'Hóc Môn', '9N 143, Hóc Môn', '+84 938 777 941', 5, 47, 'Daily 8AM-6PM', 10.8990424, 106.5927273, true, 'approved', true, 'directory', null, null),
  ('wash-pro-auto', null, 'Wash Pro Auto', 'Hóc Môn', '7 QL22, Trung Chánh 2, Bà Điểm', '+84 966 899 042', 4.7, 29, 'Daily 7:30AM-6PM', 10.8573771, 106.606244, true, 'approved', true, 'directory', null, null),
  ('rua-xe-hai-hung', null, 'Rửa xe Hải Hưng', 'Hóc Môn', '151/5B Phạm Thị Giây, Đông Thạnh', '+84 975 830 449', 4.7, 6, 'Open 24 hours', 10.8828327, 106.617021, true, 'approved', true, 'directory', null, null),
  ('hai-auto-rua-xe-va-vo', null, 'Hải Auto (rửa xe, vá vỏ)', 'Hóc Môn', '72 Ấp Mới 1', '+84 909 485 579', 5, 13, 'Daily 7AM-7PM', 10.8792238, 106.6073296, true, 'approved', true, 'directory', null, null),
  ('s2-moto-wash', null, 'S2 Moto Wash', 'Hóc Môn', '7/6B Lê Thị Hà', '+84 933 815 345', 4.4, 17, 'Daily 8AM-7PM', 10.8714863, 106.5972777, true, 'approved', true, 'directory', 'Touchless wash', null),
  ('dts-car', null, 'DTS.car', 'Hóc Môn', '63/9A Bà Triệu, KP1', '+84 989 576 677', 4.8, 17, 'Daily 6AM-9PM', 10.8846672, 106.5950566, true, 'approved', true, 'directory', 'Wash + parking', null),
  ('auto-ps', null, 'Auto PS', 'Củ Chi', '59C ĐTL2, Củ Chi', '+84 328 239 454', 5, 23, 'Mon-Sat 7:30AM-5:30PM', 10.9405289, 106.5447509, true, 'approved', true, 'directory', 'Wash + bodywork/paint', null),
  ('autobot-auto365-cu-chi', null, 'Autobot - Auto365 Củ Chi', 'Củ Chi', '122 TL8, Tân An Hội', '+84 921 365 365', 4.3, 55, 'Daily 8AM-6PM', 10.9711094, 106.4914318, true, 'approved', true, 'directory', null, null),
  ('tiem-rua-xe-56', null, 'Tiệm Rửa Xe 56', 'District 6', '56 Minh Phụng, Bình Tây', '+84 944 414 474', 5, 1, 'Varies', 10.7485346, 106.6426126, true, 'approved', true, 'directory', null, null),
  ('an-khang-detailing', null, 'An Khang Detailing', 'District 6', '624 Hồng Bàng, Minh Phụng', '+84 909 227 445', 4.9, 41, 'Daily 8AM-5:30PM', 10.7543336, 106.644474, true, 'approved', true, 'directory', '80-step detailing', null),
  ('auto365-vn-quan-6', null, 'Auto365.vn Quận 6', 'District 6', '60-62 Vành Đai, Bình Phú', '+84 587 365 365', 4.7, 47, 'Daily 8:30AM-6:30PM', 10.7322502, 106.6249828, true, 'approved', true, 'directory', 'Repair + wash', null),
  ('proauto-quan-11', null, 'ProAuto - Quận 11', 'District 11', '1511-1513 Đ. 3 Tháng 2, Minh Phụng', '+84 901 800 001', 4.9, 257, 'Daily 8AM-6PM', 10.7559281, 106.6458365, true, 'approved', true, 'directory', 'Repair + upgrade', null),
  ('tiem-rua-xe-tin-tin', null, 'Tiệm Rửa Xe Tin Tin', 'Thủ Đức', '5A Đ.6, KP3, Linh Xuân', '+84 903 661 150', 3.4, 133, 'Daily 6:30AM-7PM', 10.8604005, 106.7678721, true, 'approved', true, 'directory', null, null),
  ('auto-care-68-quan-12', null, 'Auto Care 68 - Quận 12', 'District 12', '38/61 Đông Hưng Thuận 11', '+84 986 551 161', 4.9, 38, 'Daily 8AM-5:30PM', 10.8450829, 106.6297194, true, 'approved', true, 'directory', null, null),
  ('tiem-rua-xe-hoa', null, 'Tiệm Rửa Xe Hòa', 'District 11', 'Đ.9/21 Đ.2, Cư xá Bình Thới', null, 4.5, 2, 'Daily 8AM-4PM', 10.7640202, 106.6475223, true, 'approved', true, 'directory', null, null),
  ('rua-xe-24h-car-e', null, 'Rửa xe 24h CAR-E', 'Thủ Đức (Q2)', '11 Đ. Số 1, Bình Khánh, An Khánh', '+84 986 658 659', 4.3, 86, 'Daily 5:30AM-11:30PM', 10.7849511, 106.730294, true, 'approved', true, 'directory', 'Good for bikes', null),
  ('rua-xe-thanh-binh', null, 'Rửa Xe Thanh Bình', 'District 1', '210 Nguyễn Trãi, Bến Thành', null, 3.4, 104, 'Varies', 10.7672983, 106.6883697, true, 'approved', true, 'directory', null, null),
  ('thanh-an-autocare', null, 'Thanh An Autocare', 'District 7', '123 Nguyễn Thị Thập, Tân Mỹ', '+84 906 662 441', 4.9, 553, 'Daily 7:30AM-5:30PM', 10.737913, 106.7207105, true, 'approved', true, 'directory', 'Wash + tires + repair', null),
  ('rua-xe-ngoc-anh-oto-xe-may', null, 'Rửa Xe Ngọc Anh (ôtô & xe máy)', 'District 5', '100 Hùng Vương, An Đông', '+84 886 680 079', 4.9, 7, 'Daily 7AM-7PM', 10.7588804, 106.6711183, true, 'approved', true, 'directory', null, null)
on conflict (id) do nothing;
