"use client";

import { useSearchParams } from "next/navigation";
import { ChatWorkspace } from "../components/chat/ChatWorkspace.jsx";

// Customer chat: their shop threads + a support thread with admins. A `?c=<id>`
// param (set when tapping "Message shop") opens that thread directly.
export function ChatScreen() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("c");

  return (
    <section className="h-full bg-white">
      <ChatWorkspace allowSupport initialConversationId={initial} />
    </section>
  );
}
