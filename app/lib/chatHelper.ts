import { ref, push, set, update, serverTimestamp, get } from "@/app/lib/dynamoRtdbCompat";
import { db } from "./firebase";
import { sendNotification } from "./notificationHelper";

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  attachment?: {
    url: string;
    type: string; // 'image' | 'video' | 'pdf' | 'file'
    name: string;
    size?: number;
  };
}

export interface ChatPreview {
  chatId: string;
  lastMessage: string;
  timestamp: number;
  unreadCount?: number;
  otherUserId: string;
  lastReadAt?: number;
}

/**
 * Generates a unique, consistent chatId from two user IDs.
 */
export const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

/**
 * Updates the typing status of a user in a specific chat.
 */
export const setTypingStatus = async (chatId: string, uid: string, isTyping: boolean) => {
  const typingRef = ref(db, `chats/${chatId}/typing/${uid}`);
  await set(typingRef, isTyping ? true : null);
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
  text: string,
  attachment?: ChatMessage["attachment"]
) => {
  const chatId = getChatId(senderId, receiverId);
  const timestamp = Date.now();

  const newMessage: ChatMessage = {
    senderId,
    senderName,
    text,
    timestamp,
    attachment
  };

  // 1. Add message to history
  const messageRef = push(ref(db, `chats/${chatId}/messages`));
  await set(messageRef, newMessage);

  // 2. Read current unread count for receiver
  const receiverChatRef = ref(db, `user_chats/${receiverId}/${senderId}`);
  const receiverSnap = await get(receiverChatRef);
  const currentUnread = receiverSnap.exists()
    ? (receiverSnap.val().unreadCount || 0)
    : 0;

  // 3. Atomic batch update for both users' chat previews
  const updates: Record<string, any> = {};

  // Sender: always 0 unread (they just sent it)
  updates[`user_chats/${senderId}/${receiverId}/lastMessage`] = text;
  updates[`user_chats/${senderId}/${receiverId}/timestamp`] = timestamp;
  updates[`user_chats/${senderId}/${receiverId}/chatId`] = chatId;
  updates[`user_chats/${senderId}/${receiverId}/otherUserId`] = receiverId;
  updates[`user_chats/${senderId}/${receiverId}/otherUserName`] = receiverName;
  updates[`user_chats/${senderId}/${receiverId}/unreadCount`] = 0;

  // Receiver: increment unread by 1
  updates[`user_chats/${receiverId}/${senderId}/lastMessage`] = text;
  updates[`user_chats/${receiverId}/${senderId}/timestamp`] = timestamp;
  updates[`user_chats/${receiverId}/${senderId}/chatId`] = chatId;
  updates[`user_chats/${receiverId}/${senderId}/otherUserId`] = senderId;
  updates[`user_chats/${receiverId}/${senderId}/otherUserName`] = senderName;
  updates[`user_chats/${receiverId}/${senderId}/unreadCount`] = currentUnread + 1;

  await update(ref(db), updates);

  const notificationBody = text 
    ? (text.length > 50 ? text.slice(0, 47) + "..." : text)
    : (attachment ? `Sent an attachment: ${attachment.name}` : "New message");

  // 4. Send In-app notification
  await sendNotification([receiverId], {
    title: "New Message",
    message: `${senderName}: ${notificationBody}`,
    type: "system",
    link: `/dashboard`,
  });
};

/**
 * Resets the unread count for a specific chat to 0.
 * Also updates the lastReadAt timestamp for seen status.
 * Called when a user opens a conversation.
 */
export const markAsRead = async (uid: string, otherId: string) => {
  const timestamp = Date.now();
  await update(ref(db, `user_chats/${uid}/${otherId}`), { 
    unreadCount: 0,
    lastReadAt: timestamp
  });
};


