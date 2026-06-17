import { OwnerShopFormScreen } from "@/screens/owner/OwnerShopFormScreen.jsx";

export default async function OwnerEditShopPage({ params }) {
  const { shopId } = await params;
  return <OwnerShopFormScreen shopId={shopId} />;
}
