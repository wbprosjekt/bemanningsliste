"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import ProjectDashboard from "@/components/ProjectDashboard";

export default function DashboardPage() {
  return (
    <ProtectedRoute requireProfile={true}>
      <ProjectDashboard />
    </ProtectedRoute>
  );
}
