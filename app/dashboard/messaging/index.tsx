"use client";

import React, { useState, useEffect, useRef } from "react";
import { ref, onValue, off } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { UserRecord } from "../admin/types";
import { getChatId, sendMessage, ChatMessage, setTypingStatus, markAsRead } from "../../lib/chatHelper";
import { S, FONT } from "./types";

import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

interface MessagingProps {
  users: UserRecord[];
  isMobile?: boolean;
}

export default function MessagingContainer({ users, isMobile }: MessagingProps) {
  const { user, userData } = useAuth();
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserPresence, setOtherUserPresence] = useState<{ online: boolean; lastSeen: number } | null>(null);
  const [receiverLastRead, setReceiverLastRead] = useState<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen for ALL chat previews for the current user
  useEffect(() => {
    if (!user) return;
    const previewsRef = ref(db, `user_chats/${user.uid}`);
    const unsubscribe = onValue(previewsRef, (snapshot) => {
      setPreviews(snapshot.exists() ? snapshot.val() : {});
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Handle selection: mark as read and listen for typing/presence
  useEffect(() => {
    if (user && selectedUser) {
      markAsRead(user.uid, selectedUser.uid);
      const chatId = getChatId(user.uid, selectedUser.uid);
      
      const typingRef = ref(db, `chats/${chatId}/typing/${selectedUser.uid}`);
      const typingUnsub = onValue(typingRef, (snap) => setOtherUserTyping(!!snap.val()));

      const presenceRef = ref(db, `users/${selectedUser.uid}/presence`);
      const presenceUnsub = onValue(presenceRef, (snap) => {
        if (snap.exists()) setOtherUserPresence(snap.val());
      });

      const readRef = ref(db, `user_chats/${selectedUser.uid}/${user.uid}/lastReadAt`);
      const readUnsub = onValue(readRef, (snap) => setReceiverLastRead(snap.val() || 0));

      const msgRef = ref(db, `chats/${chatId}/messages`);
      const msgUnsub = onValue(msgRef, (snapshot) => {
        const msgs: ChatMessage[] = [];
        if (snapshot.exists()) {
          snapshot.forEach(child => {
            msgs.push({ id: child.key!, ...child.val() });
          });
        }
        setMessages(msgs);
      });

      return () => {
        typingUnsub();
        presenceUnsub();
        readUnsub();
        msgUnsub();
      };
    } else {
      setMessages([]);
    }
  }, [selectedUser?.uid, user?.uid]);

  const handleTyping = (text: string) => {
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

  const handleSend = async (text: string, attachment?: any) => {
    if ((!text.trim() && !attachment) || !user || !selectedUser || !userData) return;
    
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const chatId = getChatId(user.uid, selectedUser.uid);
    setTypingStatus(chatId, user.uid, false);

    await sendMessage(
      user.uid,
      userData.name || "Unknown",
      selectedUser.uid,
      selectedUser.name || "User",
      text,
      attachment
    );
  };

  if (!user) return null;

  return (
    <div style={S.container(isMobile)}>
      {/* Sidebar Area */}
      <ChatSidebar 
        currentUser={{ uid: user.uid, role: userData?.role, name: userData?.name }}
        users={users}
        previews={previews}
        selectedUserId={selectedUser?.uid}
        onSelectUser={setSelectedUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        collapsed={!!(isMobile && selectedUser)}
      />

      {/* Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {selectedUser ? (
          <>
            <ChatWindow 
              selectedUser={selectedUser}
              messages={messages}
              currentUserId={user.uid}
              isMobile={!!isMobile}
              onBack={() => setSelectedUser(null)}
              otherUserTyping={otherUserTyping}
              otherUserPresence={otherUserPresence}
              receiverLastRead={receiverLastRead}
            />
            <MessageInput 
              onSend={handleSend}
              onTyping={handleTyping}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "#f8fafc" }}>
             <div style={{ textAlign: "center", padding: 40 }}>
               <div style={{ 
                 width: 160, height: 160, margin: "0 auto 30px", borderRadius: 40, 
                 background: "#fff", display: "flex", alignItems: "center", 
                 justifyContent: "center", fontSize: 60, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" 
               }}>💬</div>
               <h1 style={{ fontSize: 32, color: "#1e293b", fontWeight: 700, marginBottom: 12, fontFamily: FONT }}>Eurus Team Messaging</h1>
               <p style={{ color: "#64748b", fontSize: 15, maxWidth: 300, margin: "0 auto", lineHeight: 1.6 }}>Select a team member from the left to start a secure conversation.</p>
             </div>
             <div style={{ position: "absolute", bottom: 40, color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Secure End-to-End Encryption
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

