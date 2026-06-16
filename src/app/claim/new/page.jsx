import { ClaimListingScreen } from "@/screens/ClaimListingScreen.jsx";

// Apply for a brand-new car wash that isn't on the map yet. The static "new"
// segment takes precedence over the dynamic /claim/[shopId] route.
export default function NewListingPage() {
  return <ClaimListingScreen isNew />;
}
