"use client";

import { useSearchParams } from "next/navigation";
import { ChatWorkspace } from "../../components/chat/ChatWorkspace.jsx";

// Admin support inbox: every support thread from customers, owners and applicants.
// Admins can read and reply to all of them (RLS grants is_admin access). A
// `?c=<id>` param (set from the Applications "Message" button) opens that thread.
export function AdminMessagesScreen() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("c");

  return (
    <div className="h-full">
      <ChatWorkspace kindFilter="support" initialConversationId={initial} />
    </div>
  );
}
