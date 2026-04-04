"use client";

import { useState, useEffect, useRef } from "react";
import { ref, onValue, update, remove, query, limitToLast, orderByKey } from "firebase/database";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen for notification updates
    const notifRef = query(ref(db, `notifications/${user.uid}`), orderByKey(), limitToLast(20));
    const unsubscribe = onValue(notifRef, (snapshot) => {
      const data: any[] = [];
      let unread = 0;
      snapshot.forEach((child) => {
        const val = child.val();
        data.push({ id: child.key, ...val });
        if (!val.read) unread++;
      });
      // Sort: newest first
      setNotifications(data.reverse());
      setUnreadCount(unread);
    });

    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    if (!user?.uid) return;
    try {
      await update(ref(db, `notifications/${user.uid}/${id}`), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    if (!user?.uid || notifications.length === 0) return;
    const updates: any = {};
    notifications.forEach((n) => {
      if (!n.read) updates[`notifications/${user.uid}/${n.id}/read`] = true;
    });
    try {
      await update(ref(db), updates);
    } catch (err) {
      console.error(err);
    }
  };

  const clearAll = async () => {
    if (!user?.uid || !confirm("Clear all notifications?")) return;
    try {
      await remove(ref(db, `notifications/${user.uid}`));
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: 40, height: 40, borderRadius: 10, border: "1px solid #e2e8f0", 
          background: "#fff", color: "#64748b", cursor: "pointer", 
          display: "flex", alignItems: "center", justifyContent: "center", 
          transition: "all 0.2s", position: "relative" 
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{ 
            position: "absolute", top: -4, right: -4, 
            minWidth: 18, height: 18, borderRadius: 9, 
            background: "#ef4444", color: "#fff", 
            fontSize: 10, fontWeight: 700, 
            display: "flex", alignItems: "center", justifyContent: "center", 
            border: "2px solid #fff", padding: "0 4px" 
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{ 
          position: "absolute", top: 48, right: 0, 
          width: 320, maxHeight: 440, 
          background: "#fff", borderRadius: 14, 
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)", 
          border: "1px solid #f1f5f9", zIndex: 999, 
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "fadeInUp 0.2s ease-out" 
        }}>
          <style>{`
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>

          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0 }}>Notifications</h3>
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={markAllRead} 
                style={{ background: "none", border: "none", fontSize: 11, color: "#6366f1", fontWeight: 600, cursor: "pointer" }}
              >
                Mark all read
              </button>
              <button 
                onClick={clearAll} 
                style={{ background: "none", border: "none", fontSize: 11, color: "#94a3b8", fontWeight: 600, cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                 <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                 <p style={{ fontSize: 12, color: "#94a3b8" }}>You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => markAsRead(n.id)}
                  style={{ 
                    padding: "16px 20px", borderBottom: "1px solid #f8fafc", 
                    cursor: "pointer", background: n.read ? "transparent" : "#6366f108", 
                    transition: "background 0.2s" 
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : "#6366f108"}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ 
                      width: 8, height: 8, borderRadius: "50%", 
                      background: n.read ? "transparent" : "#6366f1", marginTop: 6, flexShrink: 0 
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>
                        {n.timestamp ? new Date(n.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: 12, textAlign: "center", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
            <button style={{ color: "#64748b", fontSize: 11, fontWeight: 600, background: "none", border: "none", cursor: "default" }}>
              Total {notifications.length} notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
