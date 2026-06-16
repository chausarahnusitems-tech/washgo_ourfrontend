"use client";

import { ChatWorkspace } from "../../components/chat/ChatWorkspace.jsx";

// Owner messages: customer threads about their shops, plus their own support
// thread with admins.
export function OwnerMessagesScreen() {
  return (
    <div className="h-full">
      <ChatWorkspace allowSupport />
    </div>
  );
}
