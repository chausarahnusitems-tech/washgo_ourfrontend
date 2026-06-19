import { Suspense } from "react";
import { PaymentSuccessScreen } from "@/screens/PaymentSuccessScreen.jsx";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessScreen />
    </Suspense>
  );
}
