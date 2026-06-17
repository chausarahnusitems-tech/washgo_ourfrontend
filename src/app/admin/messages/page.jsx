import { Suspense } from "react";
import { AdminMessagesScreen } from "@/screens/admin/AdminMessagesScreen.jsx";

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={null}>
      <AdminMessagesScreen />
    </Suspense>
  );
}
