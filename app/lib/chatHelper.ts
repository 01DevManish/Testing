import { ref, push, set, update } from "firebase/database";
import { db } from "./firebase";
import { sendNotification } from "./notificationHelper";

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ChatPreview {
  chatId: string;
  lastMessage: string;
  timestamp: number;
  unreadCount?: number;
  otherUserId: string;
}

/**
 * Generates a unique, consistent chatId from two user IDs.
 */
export const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

/**
 * Sends a message to a chat and updates metadata for previews.
 * Also increments the receiver's unread count.
 */
export const sendMessage = async (
  senderId: string,
  senderName: string,
  receiverId: string,
  receiverName: string,
  text: string
) => {
  const chatId = getChatId(senderId, receiverId);
  const timestamp = Date.now();

  const newMessage: ChatMessage = {
    senderId,
    senderName,
    text,
    timestamp,
  };

  // 1. Add message to history
  const messageRef = push(ref(db, `chats/${chatId}/messages`));
  await set(messageRef, newMessage);

  // 2. Read current unread count for receiver (dynamically import 'get' to avoid issues)
  const { get } = await import("firebase/database");
  const receiverChatRef = ref(db, `user_chats/${receiverId}/${senderId}`);
  const receiverSnap = await get(receiverChatRef);
  const currentUnread = receiverSnap.exists()
    ? (receiverSnap.val().unreadCount || 0)
    : 0;

  // 3. Atomic batch update for both users' chat previews
  const updates: Record<string, any> = {};

  // Sender: always 0 unread (they just sent it)
  updates[`user_chats/${senderId}/${receiverId}`] = {
    lastMessage: text,
    timestamp,
    chatId,
    otherUserId: receiverId,
    otherUserName: receiverName,
    unreadCount: 0,
  };

  // Receiver: increment unread by 1
  updates[`user_chats/${receiverId}/${senderId}`] = {
    lastMessage: text,
    timestamp,
    chatId,
    otherUserId: senderId,
    otherUserName: senderName,
    unreadCount: currentUnread + 1,
  };

  await update(ref(db), updates);

  // 4. Send In-app notification (array expected by sendNotification)
  await sendNotification([receiverId], {
    title: "New Message",
    message: `${senderName}: ${text.length > 50 ? text.slice(0, 47) + "..." : text}`,
    type: "system",
    link: `/dashboard`,
  });
};

/**
 * Resets the unread count for a specific chat to 0.
 * Called when a user opens a conversation.
 */
export const markAsRead = async (uid: string, otherId: string) => {
  await update(ref(db, `user_chats/${uid}/${otherId}`), { unreadCount: 0 });
};
