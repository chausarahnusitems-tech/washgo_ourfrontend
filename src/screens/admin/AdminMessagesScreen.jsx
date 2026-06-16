"use client";

import { ChatWorkspace } from "../../components/chat/ChatWorkspace.jsx";

// Admin support inbox: every support thread from customers and owners. Admins
// can read and reply to all of them (RLS grants is_admin access).
export function AdminMessagesScreen() {
  return (
    <div className="h-full">
      <ChatWorkspace kindFilter="support" />
    </div>
  );
}
