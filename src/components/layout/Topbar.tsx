"use client";
import { useEffect, useState } from "react";
import { Search, LogOut, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";

export default function Topbar({ onSearch }: { onSearch: () => void }) {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const loadName = async () => {
      try {
        if (!user) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("fornavn, etternavn")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const name = [data?.fornavn, data?.etternavn].filter(Boolean).join(" ").trim();
        setDisplayName(name || user.email || "Bruker");
      } catch (e) {
        setDisplayName(user?.email || "Bruker");
      }
    };
    loadName();
    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/auth");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-8 h-16 bg-slate-800 border-b border-slate-700 shadow-sm">
      {/* Venstre: Logo */}
      <div className="flex items-center min-w-[120px]">
        <h2 className="font-bold text-lg tracking-tight text-white">FieldNote</h2>
      </div>

      {/* Midten: søkefelt */}
      <div className="flex-1 flex justify-center">
        <button
          className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-2 text-base font-medium max-w-xl w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          onClick={onSearch}
          title="Åpne søk (Cmd+K)"
          tabIndex={0}
          style={{ minWidth: 300 }}
        >
          <Search className="h-5 w-5 text-blue-500 opacity-70" />
          <span className="text-gray-500 text-base flex-1 text-left">Søk i alt…</span>
          <kbd className="ml-2 px-2 py-0.5 border border-gray-300 rounded text-xs bg-gray-50 shadow-sm text-gray-700">⌘K</kbd>
        </button>
      </div>

      {/* Høyre: Profil/dropdown */}
      <div className="flex items-center min-w-[120px] justify-end max-w-[220px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 text-white font-semibold px-3 py-1.5 rounded hover:bg-slate-700 transition group max-w-full"
              aria-label="Brukermeny"
            >
              <User className="h-4 w-4 opacity-90 flex-shrink-0" />
              <span className="truncate">{displayName || user?.email || "Bruker"}</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="group-hover:translate-y-[2px] transition flex-shrink-0"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700">
              <LogOut className="h-4 w-4 mr-2" />
              Logg ut
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
