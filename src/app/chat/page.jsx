import { Suspense } from "react";
import { ChatScreen } from "@/screens/ChatScreen.jsx";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatScreen />
    </Suspense>
  );
}
