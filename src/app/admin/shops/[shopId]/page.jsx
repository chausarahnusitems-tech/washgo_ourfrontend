import { AdminShopReviewScreen } from "@/screens/admin/AdminShopReviewScreen.jsx";

export default async function AdminShopReviewPage({ params }) {
  const { shopId } = await params;
  return <AdminShopReviewScreen shopId={shopId} />;
}
