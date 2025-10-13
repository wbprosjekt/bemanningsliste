"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import ProjectDashboard from "@/components/ProjectDashboard";
import { useAuth } from "@/hooks/useAuth";

function DashboardPage() {
  const { profile } = useAuth();
  
  return <ProjectDashboard profile={profile} />;
}

export default function DashboardPageWrapper() {
  return (
    <ProtectedRoute requireProfile={true}>
      <DashboardPage />
    </ProtectedRoute>
  );
}
