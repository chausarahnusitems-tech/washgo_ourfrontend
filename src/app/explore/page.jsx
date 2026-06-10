import { Suspense } from "react";
import { ExploreScreen } from "@/screens/ExploreScreen.jsx";

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreScreen />
    </Suspense>
  );
}
