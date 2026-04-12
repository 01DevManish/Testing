"use client";

import MessagingContainer from "../dashboard/messaging/index";
import { UserRecord } from "../dashboard/admin/types";

interface MessagingTabProps {
  users: UserRecord[];
  isMobile?: boolean;
}

/**
 * Backward compatibility wrapper for the new modular Messaging system.
 * This ensures all existing dashboard tabs (Admin, Dispatch, etc.) 
 * get the new UI and S3 attachment features instantly.
 */
export default function MessagingTab(props: MessagingTabProps) {
  return <MessagingContainer {...props} />;
}

