"use client";

import { useAuth } from "../context/AuthContext";
import NotificationToast from "./NotificationToast";

export default function NotificationToastContainer() {
  const { toasts } = useAuth();
  
  return <NotificationToast toasts={toasts} />;
}
