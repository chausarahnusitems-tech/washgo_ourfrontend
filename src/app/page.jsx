import { Suspense } from "react";
import { HomeScreen } from "@/screens/HomeScreen.jsx";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
