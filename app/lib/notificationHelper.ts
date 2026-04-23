export interface NotificationData {
  title: string;
  message: string;
  type: "task" | "inventory" | "system" | "order";
  link?: string;
  actorId?: string;
  actorName?: string;
}

export async function sendNotification(uids: string[], data: NotificationData) {
  if (!uids || uids.length === 0) return;

  const uniqueUids = Array.from(new Set(uids.filter(Boolean)));
  await Promise.all(
    uniqueUids.map(async (uid) => {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUid: uid,
            ...data,
          }),
        });
      } catch (err) {
        console.error(`Failed to send notification to user ${uid}:`, err);
      }
    })
  );
}
