export interface NotificationData {
  title: string;
  message: string;
  type: "task" | "inventory" | "system" | "order";
  link?: string;
  actorId?: string;
  actorName?: string;
}

export async function sendNotification(uids: string[], data: NotificationData) {
  // Notifications are globally disabled to reduce API load.
  void uids;
  void data;
  return;
}
