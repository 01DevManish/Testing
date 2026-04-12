"use client";

import React from "react";
import LogViewer from "../../components/Admin/LogViewer";

interface LogsTabProps {
  S: any;
  isMobile: boolean;
  isTablet: boolean;
  users: { uid: string; name: string }[];
}

export default function LogsTab({ isMobile, users }: LogsTabProps) {
  return (
    <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
      <LogViewer isMobile={isMobile} users={users} />
    </div>
  );
}
