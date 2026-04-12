export interface ActivityInput {
  type: "dispatch" | "inventory" | "user" | "task" | "system";
  action: "create" | "update" | "delete" | "status_change" | "adjustment" | "login" | "logout";
  title: string;
  description: string;
  userId: string;
  userName: string;
  userRole: string;
  metadata?: Record<string, any>;
}

/**
 * Logs an activity to the system.
 * Now migrated to DynamoDB via our internal API for persistent storage.
 */
export const logActivity = async (input: ActivityInput) => {
  try {
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to log activity: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (e) {
    console.error("Failed to log activity to DynamoDB:", e);
    
    // Fallback: We could theoretically log to Firebase if DynamoDB fails, 
    // but for now we'll just log to console to keep it clean.
    return null;
  }
};
