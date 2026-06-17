import { ClaimListingScreen } from "@/screens/ClaimListingScreen.jsx";

export default async function ClaimListingPage({ params }) {
  const { shopId } = await params;
  return <ClaimListingScreen shopId={shopId} />;
}
