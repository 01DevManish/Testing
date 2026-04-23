/**
 * Dynamo-only mode: Firebase Cloud Messaging is disabled.
 * Keep helper signatures stable to avoid touching all callers.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  return null;
}

export async function onForegroundMessage(_callback: (payload: any) => void) {
  // no-op
}
