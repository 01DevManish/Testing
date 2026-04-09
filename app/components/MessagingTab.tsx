"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { ref, onValue, off, push, set, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { UserRecord } from "../dashboard/admin/types";
import { getChatId, sendMessage, ChatMessage, setTypingStatus, markAsRead } from "../lib/chatHelper";

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
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserPresence, setOtherUserPresence] = useState<{ online: boolean; lastSeen: number } | null>(null);
  const [receiverLastRead, setReceiverLastRead] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [messages, otherUserTyping]);

  // 3. Handle selection: mark as read and listen for typing/presence
  useEffect(() => {
    if (user && selectedUser) {
      markAsRead(user.uid, selectedUser.uid);

      const chatId = getChatId(user.uid, selectedUser.uid);
      
      // Listen for other user typing
      const typingRef = ref(db, `chats/${chatId}/typing/${selectedUser.uid}`);
      const typingUnsub = onValue(typingRef, (snap) => setOtherUserTyping(!!snap.val()));

      // Listen for other user presence
      const presenceRef = ref(db, `users/${selectedUser.uid}/presence`);
      const presenceUnsub = onValue(presenceRef, (snap) => {
        if (snap.exists()) setOtherUserPresence(snap.val());
      });

      // Listen for other user's read receipt for THIS chat
      const readRef = ref(db, `user_chats/${selectedUser.uid}/${user.uid}/lastReadAt`);
      const readUnsub = onValue(readRef, (snap) => setReceiverLastRead(snap.val() || 0));

      return () => {
        typingUnsub();
        presenceUnsub();
        readUnsub();
      };
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

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!user || !selectedUser) return;

    const chatId = getChatId(user.uid, selectedUser.uid);
    
    if (!isTyping) {
      setIsTyping(true);
      setTypingStatus(chatId, user.uid, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(chatId, user.uid, false);
    }, 3000);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !user || !selectedUser || !userData) return;

    const text = inputText.trim();
    setInputText(""); // Clear instantly
    
    // Stop typing indicator
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const chatId = getChatId(user.uid, selectedUser.uid);
    setTypingStatus(chatId, user.uid, false);

    await sendMessage(
      user.uid,
      userData.name || "Unknown",
      selectedUser.uid,
      selectedUser.name || "User",
      text
    );
  };

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return "Offline";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return `last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const S = {
    container: { display: "flex", height: "100%", background: "#fff", border: "1px solid #e2e8f0", overflow: "hidden", position: "relative" } as React.CSSProperties,
    sidebar: { width: isMobile && selectedUser ? 0 : 350, borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", transition: "width 0.3s", background: "#fff" } as React.CSSProperties,
    chatWindow: { flex: 1, display: (isMobile && !selectedUser) ? "none" : "flex", flexDirection: "column", background: "#efeae2" /* WhatsApp background color */ } as React.CSSProperties,
    userItem: (isSelected: boolean) => ({
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer",
      background: isSelected ? "#f0f2f5" : "transparent",
      borderBottom: "1px solid #f0f2f5",
      transition: "all 0.1s",
    }),
    bubbleContainer: (isMine: boolean) => ({
      display: "flex", flexDirection: "column", alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "80%", marginBottom: 4
    }) as React.CSSProperties,
    bubble: (isMine: boolean) => ({
      padding: "8px 12px", borderRadius: 8, fontSize: 14.5, lineHeight: 1.4,
      background: isMine ? "#d9fdd3" : "#fff",
      color: "#111b21",
      boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
      position: "relative",
      wordBreak: "break-word",
    }) as React.CSSProperties,
    tick: { fontSize: 16, marginLeft: 4, display: "inline-flex", verticalAlign: "middle", lineHeight: 1 },
  };

  return (
    <div style={S.container}>
      {/* User Selection Sidebar */}
      <div style={S.sidebar}>
        <div style={{ padding: "16px 20px", background: "#f0f2f5", display: "flex", alignItems: "center", gap: 12 }}>
           <div style={{ width: 40, height: 40, borderRadius: "50%", background: roleBg[userData?.role || "user"], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600 }}>
              {userData?.name?.[0]?.toUpperCase() || "U"}
           </div>
           <h3 style={{ fontSize: 17, fontWeight: 600, color: "#111b21" }}>Chats</h3>
        </div>
        <div style={{ padding: "8px 16px" }}>
          <div style={{ background: "#f0f2f5", borderRadius: 8, padding: "4px 12px", display: "flex", alignItems: "center" }}>
            <span style={{ color: "#54656f", marginRight: 12 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "8px 0", border: "none", background: "transparent", fontSize: 14, outline: "none", color: "#111b21" }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredUsers.map(u => {
            const preview = previews[u.uid];
            const hasUnread = preview?.unreadCount > 0;
            return (
              <div key={u.uid} onClick={() => setSelectedUser(u)} style={S.userItem(selectedUser?.uid === u.uid)}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: roleBg[u.role || "user"], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 600 }}>
                    {u.name?.[0]?.toUpperCase() || "U"}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                    {preview?.timestamp && (
                      <div style={{ fontSize: 12, color: hasUnread ? "#1fa855" : "#667781" }}>
                        {new Date(preview.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#667781", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {preview?.lastMessage || u.role}
                    </span>
                    {hasUnread && (
                       <span style={{ background: "#25d366", color: "#fff", fontSize: 11, fontWeight: 600, minWidth: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
                        {preview.unreadCount}
                       </span>
                    )}
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
            <div style={{ padding: "10px 16px", background: "#f0f2f5", display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid #d1d7db" }}>
              {isMobile && <button onClick={() => setSelectedUser(null)} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#54656f", marginRight: 8 }}>←</button>}
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: roleBg[selectedUser.role || "user"], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 16 }}>
                {selectedUser.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#111b21" }}>{selectedUser.name}</div>
                <div style={{ fontSize: 12, color: otherUserTyping ? "#1fa855" : "#667781" }}>
                  {otherUserTyping ? "typing..." : (otherUserPresence?.online ? "Online" : formatLastSeen(otherUserPresence?.lastSeen || 0))}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, padding: "20px 5% 10px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                   <p style={{ background: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 12, color: "#54656f", boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)" }}>Messages are end-to-end encrypted.</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMine = m.senderId === user?.uid;
                  const isSeen = isMine && (m.timestamp <= receiverLastRead);
                  return (
                    <div key={idx} style={S.bubbleContainer(isMine)}>
                      <div style={S.bubble(isMine)}>
                        <span>{m.text}</span>
                        <div style={{ display: "inline-flex", alignItems: "center", marginLeft: 16, marginTop: 4, float: "right" }}>
                           <span style={{ fontSize: 10, color: "#667781" }}>
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            <span style={{ ...S.tick, color: isSeen ? "#53bdeb" : "#667781" }}>
                               {isSeen ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {otherUserTyping && (
                 <div style={S.bubbleContainer(false)}>
                    <div style={{ ...S.bubble(false), fontStyle: "italic", color: "#667781" }}>
                       typing...
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: "10px 16px", background: "#f0f2f5", display: "flex", alignItems: "center", gap: 12 }}>
              <form onSubmit={handleSend} style={{ flex: 1 }}>
                <input 
                  type="text" 
                  placeholder="Type a message" 
                  value={inputText}
                  onChange={(e) => handleTyping(e.target.value)}
                  style={{ width: "100%", padding: "9px 15px", borderRadius: 8, border: "none", fontSize: 15, outline: "none", background: "#fff", color: "#111b21" }}
                />
              </form>
              <button 
                onClick={handleSend}
                disabled={!inputText.trim()}
                style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: inputText.trim() ? "#00a884" : "#54656f" }}
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "#f8fafc", borderLeft: "1px solid #d1d7db" }}>
             <div style={{ width: "auto", textAlign: "center", padding: 40 }}>
               <div style={{ width: 200, height: 200, margin: "0 auto 30px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>💬</div>
               <h1 style={{ fontSize: 36, color: "#41525d", fontWeight: 300, marginBottom: 16 }}>Eurus Lifestyle Chat Room</h1>
             </div>
             <div style={{ position: "absolute", bottom: 40, color: "#8696a0", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                🔒 Secure Messaging
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

