"use client";
import { Home, Calendar, Users, ClipboardCheck, Camera, BarChart3, Settings, UserCog, Link2, Zap, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FEATURE_GLOBAL_NAV } from "@/config";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

function getCurrentYear() {
  return new Date().getFullYear();
}
function getCurrentWeek() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onOpenPhoto?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle, onOpenPhoto }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [isAdminRole, setIsAdminRole] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      try {
        if (!user) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setIsAdminRole(false);
          return;
        }
        const role = data?.role ?? '';
        setIsAdminRole(['admin', 'økonomi', 'manager', 'leder'].includes(role));
      } catch {
        setIsAdminRole(false);
      }
    };
    loadRole();
    return () => { cancelled = true; };
  }, [user]);

  const gotoBemanning = useCallback(() => {
    const yr = getCurrentYear();
    const wk = getCurrentWeek();
    router.push(`/admin/bemanningsliste/${yr}/${wk}`);
  }, [router]);

  const gotoRefusjon = useCallback(() => {
    if (isAdminRole) {
      router.push("/refusjon/admin");
    } else {
      router.push("/refusjon/min");
    }
  }, [router, isAdminRole]);

  const triggerPhotoDialog = useCallback(() => {
    if (onOpenPhoto) onOpenPhoto();
  }, [onOpenPhoto]);

  const wrap = (label: string, node: React.ReactElement) =>
    collapsed ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{node}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      node
    );

  const itemClass = (active: boolean) =>
    `flex items-center ${collapsed ? "justify-center" : "gap-3"} px-4 py-2 rounded-lg transition bg-opacity-80 ${active ? "bg-slate-700" : "hover:bg-slate-700"}`;

  return (
    <nav className={`fixed left-0 top-0 z-60 flex flex-col h-full ${collapsed ? "w-16" : "w-60"} bg-slate-800 border-r shadow-xl transition-all duration-200`}>
      <div className={`flex items-center h-16 ${collapsed ? "px-2" : "px-6"} border-b border-slate-700 justify-between`}>
        <span className={`font-bold text-xl tracking-tight text-white ${collapsed ? "sr-only" : "block"}`}>FieldNote</span>
        <button
          className="text-slate-300 hover:text-white p-2 rounded hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={onToggle}
          aria-label={collapsed ? "Utvid sidebar" : "Kollaps sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>
      <ul className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        <li>
          {wrap(
            "Hjem",
            <Link href="/" className={itemClass(pathname === "/")}>
              <Home className={`h-5 w-5 ${pathname === "/" ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Hjem</span>}
            </Link>
          )}
        </li>
        <li>
          {wrap(
            "Min uke",
            <Link href="/min/uke" className={itemClass(pathname.startsWith("/min/uke"))}>
              <Calendar className={`h-5 w-5 ${pathname.startsWith("/min/uke") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Min uke</span>}
            </Link>
          )}
        </li>
        <li>
          {wrap(
            "Bemanningsliste",
            <button onClick={gotoBemanning} className={`${itemClass(pathname.startsWith("/admin/bemanningsliste"))} text-white w-full`}>
              <Users className={`h-5 w-5 ${pathname.startsWith("/admin/bemanningsliste") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base">Bemanningsliste</span>}
            </button>
          )}
        </li>
        <li>
          {wrap(
            "Befaring",
            <Link href="/befaring" className={itemClass(pathname.startsWith("/befaring"))}>
              <ClipboardCheck className={`h-5 w-5 ${pathname.startsWith("/befaring") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Befaring</span>}
            </Link>
          )}
        </li>
        <li>
          {wrap(
            "Refusjon",
            <button onClick={gotoRefusjon} className={`${itemClass(pathname.startsWith("/refusjon"))} text-white w-full`}>
              <Zap className={`h-5 w-5 ${pathname.startsWith("/refusjon") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base">Refusjon</span>}
            </button>
          )}
        </li>
        <li>
          {wrap(
            "Foto",
            <button onClick={triggerPhotoDialog} className={`${itemClass(false)} text-white w-full`}>
              <Camera className="h-5 w-5 text-blue-400" />
              {!collapsed && <span className="font-medium text-base">Foto</span>}
            </button>
          )}
        </li>
        <li>
          {wrap(
            "Rapporter",
            <Link href="/admin/rapporter/maanedlig" className={itemClass(pathname.startsWith("/admin/rapporter"))}>
              <BarChart3 className={`h-5 w-5 ${pathname.startsWith("/admin/rapporter") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Rapporter</span>}
            </Link>
          )}
        </li>
        {!collapsed && (
          <li className="pt-2">
            <span className="text-xs px-4 text-slate-300">Admin</span>
          </li>
        )}
        <li>
          {wrap(
            "Innstillinger",
            <Link href="/admin/settings" className={itemClass(pathname.startsWith("/admin/settings"))}>
              <Settings className={`h-5 w-5 ${pathname.startsWith("/admin/settings") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Innstillinger</span>}
            </Link>
          )}
        </li>
        <li>
          {wrap(
            "Brukere",
            <Link href="/admin/brukere" className={itemClass(pathname.startsWith("/admin/brukere"))}>
              <UserCog className={`h-5 w-5 ${pathname.startsWith("/admin/brukere") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Brukere</span>}
            </Link>
          )}
        </li>
        <li>
          {wrap(
            "Integrasjoner",
            <Link href="/admin/integrasjoner" className={itemClass(pathname.startsWith("/admin/integrasjoner"))}>
              <Link2 className={`h-5 w-5 ${pathname.startsWith("/admin/integrasjoner") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Integrasjoner</span>}
            </Link>
          )}
        </li>
        <li>
          {wrap(
            "Timer",
            <Link href="/admin/timer" className={itemClass(pathname.startsWith("/admin/timer"))}>
              <BarChart3 className={`h-5 w-5 ${pathname.startsWith("/admin/timer") ? "text-blue-300" : "text-blue-400"}`} />
              {!collapsed && <span className="font-medium text-base text-white">Timer</span>}
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
