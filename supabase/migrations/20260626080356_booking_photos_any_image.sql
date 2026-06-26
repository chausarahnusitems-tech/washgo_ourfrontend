-- 0057 BOOKING PHOTOS — accept any image type. The fixed allow-list
-- (jpeg/png/webp/gif/avif/heic/heif) rejected some browser/camera MIME types,
-- failing the owner's arrival/completion photo upload. A wildcard accepts any
-- image while still blocking non-images; the 25 MB size limit still applies.
update storage.buckets
set allowed_mime_types = array['image/*']
where id = 'booking-photos';
