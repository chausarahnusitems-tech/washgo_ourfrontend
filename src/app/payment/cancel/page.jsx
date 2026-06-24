import { Suspense } from "react";
import { PaymentCancelScreen } from "@/screens/PaymentCancelScreen.jsx";

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={null}>
      <PaymentCancelScreen />
    </Suspense>
  );
}
