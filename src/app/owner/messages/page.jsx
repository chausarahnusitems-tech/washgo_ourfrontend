import { Suspense } from "react";
import { OwnerMessagesScreen } from "@/screens/owner/OwnerMessagesScreen.jsx";

export default function OwnerMessagesPage() {
  return (
    <Suspense fallback={null}>
      <OwnerMessagesScreen />
    </Suspense>
  );
}
