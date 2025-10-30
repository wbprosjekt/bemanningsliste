"use client";
import { ReactNode, useEffect, useState } from "react";
import { FEATURE_GLOBAL_NAV } from "@/config";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import GlobalSearchPalette from "@/components/layout/GlobalSearchPalette";
import ProjectPhotoUpload from "@/components/ProjectPhotoUpload";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function ClientLayoutShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const { user } = useAuth();

  // Last preferanse fra localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved != null) setCollapsed(saved === "true");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Hent orgId for foto-dialog
  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.org_id) setOrgId(data.org_id);
      } catch {
        // Ignore errors
      }
    })();
  }, [user]);

  const handleToggleSidebar = (next?: boolean) => {
    const value = next ?? !collapsed;
    setCollapsed(value);
    try { 
      localStorage.setItem("sidebar_collapsed", String(value)); 
    } catch {
      // Ignore localStorage errors
    }
  };

  useEffect(() => {
    if (!FEATURE_GLOBAL_NAV) return;
    function handler(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const key = e.key.toLowerCase();
      if ((isMac && e.metaKey && key === "k") || (!isMac && e.ctrlKey && key === "k")) {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Toggle sidebar: Cmd/Ctrl + b
      if ((isMac && e.metaKey && key === "b") || (!isMac && e.ctrlKey && key === "b")) {
        e.preventDefault();
        handleToggleSidebar();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [collapsed]);

  return (
    <div className="min-h-svh">
      {FEATURE_GLOBAL_NAV && (
        <Sidebar collapsed={collapsed} onToggle={() => handleToggleSidebar()} onOpenPhoto={() => setShowPhotoDialog(true)} />
      )}
      {FEATURE_GLOBAL_NAV && <Topbar onSearch={() => setSearchOpen(true)} />}
      <main className={FEATURE_GLOBAL_NAV ? (collapsed ? "ml-16" : "ml-60") : undefined}>{children}</main>
      {FEATURE_GLOBAL_NAV && (
        <GlobalSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
      {FEATURE_GLOBAL_NAV && (
        <ProjectPhotoUpload open={showPhotoDialog} onOpenChange={setShowPhotoDialog} orgId={orgId} />
      )}
    </div>
  );
}
