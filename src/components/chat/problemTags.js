// Predefined support-triage tags. Slugs are stored in conversations.problem_tags
// (text[]); labels are resolved through i18n (copy.js) so the picker and the
// thread header stay translatable. Keep slugs in sync with any DB-side filters.
export const PROBLEM_TAGS = [
  { slug: "service_quality", key: "tagServiceQuality" },
  { slug: "unprofessional", key: "tagUnprofessional" },
  { slug: "vehicle_damage", key: "tagVehicleDamage" },
  { slug: "late_or_noshow", key: "tagLateOrNoshow" },
  { slug: "billing", key: "tagBilling" },
  { slug: "refund", key: "tagRefund" },
  { slug: "booking", key: "tagBooking" },
  { slug: "app_bug", key: "tagAppBug" },
  { slug: "account", key: "tagAccount" },
  { slug: "membership", key: "tagMembership" },
  { slug: "rewards", key: "tagRewards" },
  { slug: "other", key: "tagOther" }
];

// Resolve a stored slug to a translated label (falls back to the raw slug for
// any tag a newer client wrote that this build doesn't know yet).
export function tagLabel(slug, t) {
  const found = PROBLEM_TAGS.find((x) => x.slug === slug);
  return found ? t(found.key) : slug;
}
