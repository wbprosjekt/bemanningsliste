"use client";
import { ReactNode, useEffect, useState } from "react";
import { FEATURE_GLOBAL_NAV } from "@/config";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import GlobalSearchPalette from "@/components/layout/GlobalSearchPalette";

export default function ClientLayoutShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Last preferanse fra localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved != null) setCollapsed(saved === "true");
    } catch {}
  }, []);

  const handleToggleSidebar = (next?: boolean) => {
    const value = next ?? !collapsed;
    setCollapsed(value);
    try { localStorage.setItem("sidebar_collapsed", String(value)); } catch {}
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
        <Sidebar collapsed={collapsed} onToggle={() => handleToggleSidebar()} />
      )}
      {FEATURE_GLOBAL_NAV && <Topbar onSearch={() => setSearchOpen(true)} />}
      <main className={FEATURE_GLOBAL_NAV ? (collapsed ? "ml-16" : "ml-60") : undefined}>{children}</main>
      {FEATURE_GLOBAL_NAV && (
        <GlobalSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
