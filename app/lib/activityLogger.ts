import { ref, push, set } from "firebase/database";
import { db } from "./firebase";
import { LoggedActivity } from "../dashboard/admin/types";

export interface ActivityInput {
  type: "dispatch" | "inventory" | "user" | "task" | "system";
  action: "create" | "update" | "delete" | "status_change" | "adjustment";
  title: string;
  description: string;
  userId: string;
  userName: string;
  userRole: string;
  metadata?: Record<string, any>;
}

export const logActivity = async (input: ActivityInput) => {
  try {
    const activityRef = ref(db, "activities");
    const newActivityRef = push(activityRef);
    
    const activity: LoggedActivity = {
      id: newActivityRef.key as string,
      ...input,
      timestamp: Date.now(),
    };
    
    await set(newActivityRef, activity);
    return activity.id;
  } catch (e) {
    console.error("Failed to log activity:", e);
    return null;
  }
};
