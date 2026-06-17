"use client";

import { useSearchParams } from "next/navigation";
import { ChatWorkspace } from "../../components/chat/ChatWorkspace.jsx";

// Owner messages: customer threads about their shops, plus their own support
// thread with admins. A `?c=<id>` param (e.g. from the reviews page) opens that
// thread directly.
export function OwnerMessagesScreen() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("c");

  return (
    <div className="h-full">
      <ChatWorkspace allowSupport initialConversationId={initial} />
    </div>
  );
}
