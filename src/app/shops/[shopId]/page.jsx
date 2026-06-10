import { Suspense } from "react";
import { DetailScreen } from "@/screens/DetailScreen.jsx";

export default async function ShopDetailPage({ params }) {
  const { shopId } = await params;
  return (
    <Suspense fallback={null}>
      <DetailScreen shopId={shopId} />
    </Suspense>
  );
}
