"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { ref, onValue, off, push, set, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { UserRecord } from "../dashboard/admin/types";
import { getChatId, sendMessage, ChatMessage } from "../lib/chatHelper";

interface MessagingTabProps {
  users: UserRecord[];
  isMobile?: boolean;
}

const roleBg: Record<string, string> = {
  admin: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  manager: "linear-gradient(135deg,#f59e0b,#fbbf24)",
  employee: "linear-gradient(135deg,#10b981,#34d399)",
  user: "linear-gradient(135deg,#3b82f6,#60a5fa)",
};

const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

export default function MessagingTab({ users, isMobile }: MessagingTabProps) {
  const { user, userData } = useAuth();
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen for ALL chat previews for the current user (for sorting & unread counts)
  useEffect(() => {
    if (!user) return;
    const previewsRef = ref(db, `user_chats/${user.uid}`);
    const unsubscribe = onValue(previewsRef, (snapshot) => {
      if (snapshot.exists()) {
        setPreviews(snapshot.val());
      } else {
        setPreviews({});
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Sort users: Active chats first (by timestamp), then alphabetical
  const sortedUsers = useMemo(() => {
    const list = [...users].filter(u => u.uid !== user?.uid);
    return list.sort((a, b) => {
      const prevA = previews[a.uid];
      const prevB = previews[b.uid];
      
      if (prevA && prevB) return prevB.timestamp - prevA.timestamp;
      if (prevA) return -1;
      if (prevB) return 1;
      
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [users, previews, user]);

  const filteredUsers = sortedUsers.filter(u => (
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. Handle selection: mark as read immediately when chat is opened
  useEffect(() => {
    if (user && selectedUser) {
      // Always mark as read when opening a conversation
      import("../lib/chatHelper").then(m => m.markAsRead(user.uid, selectedUser.uid));
    }
  }, [selectedUser?.uid, user?.uid]);

  // Listen for messages when a user is selected
  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      return;
    }

    const chatId = getChatId(user.uid, selectedUser.uid);
    const msgRef = ref(db, `chats/${chatId}/messages`);

    const unsubscribe = onValue(msgRef, (snapshot) => {
      const msgs: ChatMessage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          msgs.push({ id: child.key!, ...child.val() });
        });
      }
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user, selectedUser]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !user || !selectedUser || !userData) return;

    const text = inputText.trim();
    setInputText(""); // Clear instantly
    
    await sendMessage(
      user.uid,
      userData.name || "Unknown",
      selectedUser.uid,
      selectedUser.name || "User",
      text
    );
  };

  const S = {
    container: { display: "flex", height: "calc(100vh - 120px)", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" } as React.CSSProperties,
    sidebar: { width: isMobile && selectedUser ? 0 : 300, borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", transition: "width 0.3s" } as React.CSSProperties,
    chatWindow: { flex: 1, display: (isMobile && !selectedUser) ? "none" : "flex", flexDirection: "column", background: "#f8fafc" } as React.CSSProperties,
    userItem: (isSelected: boolean) => ({
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer",
      background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
      borderLeft: isSelected ? "4px solid #6366f1" : "4px solid transparent",
      transition: "all 0.2s",
    }),
    bubble: (isMine: boolean) => ({
      maxWidth: "75%", padding: "10px 14px", borderRadius: 16, fontSize: 14, lineHeight: 1.5,
      background: isMine ? "#6366f1" : "#fff",
      color: isMine ? "#fff" : "#1e293b",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      border: isMine ? "none" : "1px solid #e2e8f0",
      alignSelf: isMine ? "flex-end" : "flex-start",
      borderBottomRightRadius: isMine ? 4 : 16,
      borderBottomLeftRadius: isMine ? 16 : 4,
    }) as React.CSSProperties,
  };

  return (
    <div style={S.container}>
      {/* User Selection Sidebar */}
      <div style={S.sidebar}>
        <div style={{ padding: 16, borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>Messages</h3>
          <input 
            type="text" 
            placeholder="Search team members..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, background: "#f8fafc", outline: "none" }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredUsers.map(u => {
            const preview = previews[u.uid];
            const hasUnread = preview?.unreadCount > 0;
            return (
              <div key={u.uid} onClick={() => setSelectedUser(u)} style={S.userItem(selectedUser?.uid === u.uid)}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: roleBg[u.role || "user"], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600 }}>
                    {u.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  {hasUnread && (
                    <div style={{ position: "absolute", top: -6, right: -6, background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                      {preview.unreadCount}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: hasUnread ? 700 : 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                    {preview?.timestamp && (
                      <div style={{ fontSize: 10, color: hasUnread ? "#6366f1" : "#94a3b8" }}>
                        {new Date(preview.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: hasUnread ? "#1e293b" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: hasUnread ? 500 : 400 }}>
                    {preview?.lastMessage || u.role}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Interface */}
      <div style={S.chatWindow}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: "14px 20px", background: "#fff", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
              {isMobile && <button onClick={() => setSelectedUser(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>←</button>}
              <div style={{ width: 34, height: 34, borderRadius: 10, background: roleBg[selectedUser.role || "user"], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600 }}>
                {selectedUser.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{selectedUser.name}</div>
                <div style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>Active Now</div>
              </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#94a3b8", gap: 12 }}>
                  <div style={{ fontSize: 40 }}>💬</div>
                  <p style={{ fontSize: 14 }}>No messages yet. Say hello to {selectedUser.name}!</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMine = m.senderId === user?.uid;
                  return (
                    <div key={idx} style={S.bubble(isMine)}>
                      <div>{m.text}</div>
                      <div style={{ fontSize: 10, color: isMine ? "rgba(255,255,255,0.7)" : "#94a3b8", marginTop: 4, textAlign: "right" }}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} style={{ padding: "16px 20px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", gap: 12 }}>
              <input 
                type="text" 
                placeholder="Type a message..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{ flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", background: "#f8fafc" }}
              />
              <button 
                type="submit"
                disabled={!inputText.trim()}
                style={{ padding: "0 24px", borderRadius: 12, border: "none", background: "#6366f1", color: "#fff", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", opacity: inputText.trim() ? 1 : 0.6 }}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#94a3b8", gap: 16 }}>
             <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>👋</div>
             <div style={{ textAlign: "center" }}>
               <h3 style={{ fontSize: 18, color: "#1e293b", marginBottom: 6 }}>Welcome to Messages</h3>
               <p style={{ fontSize: 14 }}>Select a team member from the left to start a conversation.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
