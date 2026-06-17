import { Suspense } from "react";
import { TopUpScreen } from "@/screens/TopUpScreen.jsx";

export default function TopUpPage() {
  return (
    <Suspense fallback={null}>
      <TopUpScreen />
    </Suspense>
  );
}
