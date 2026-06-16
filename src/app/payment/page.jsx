import { Suspense } from "react";
import { PaymentScreen } from "@/screens/PaymentScreen.jsx";

export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentScreen />
    </Suspense>
  );
}
