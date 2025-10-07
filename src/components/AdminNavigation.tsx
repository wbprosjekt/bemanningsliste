"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Home,
  Users,
  BarChart3,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Menu,
  Bell,
} from "lucide-react";

interface AdminNavigationProps {
  profile: {
    fornavn?: string;
    etternavn?: string;
  } | null;
}

export default function AdminNavigation({ profile }: AdminNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setShowLogoutDialog(false);
  };

  const isActive = (path: string) => pathname.startsWith(path);

  // Function to get current week number
  const getCurrentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return weekNumber;
  };

  const getCurrentYear = () => new Date().getFullYear();

  return (
    <>
      <nav className="bg-gray-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <button 
                onClick={() => router.push("/")} 
                className="text-xl font-bold hover:text-blue-300 transition-colors"
              >
                Bemanningsliste
              </button>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => router.push("/")}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/") && pathname === "/"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Hjem</span>
              </button>

              <button
                onClick={() => router.push(`/admin/bemanningsliste/${getCurrentYear()}/${getCurrentWeek()}`)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/bemanningsliste")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Bemanningsliste</span>
              </button>

              <button
                onClick={() => router.push("/admin/rapporter/maanedlig")}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/rapporter")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Rapporter</span>
              </button>

              <button
                onClick={() => router.push("/admin/settings")}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/settings")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Bell className="h-4 w-4" />
                <span>Innstillinger</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive("/admin/brukere") ||
                      isActive("/admin/integrasjoner") ||
                      isActive("/admin/timer")
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Admin</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => router.push("/admin/brukere")}>
                    <Users className="h-4 w-4 mr-2" />
                    <span>Brukere</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/admin/integrasjoner")}>
                    <Settings className="h-4 w-4 mr-2" />
                    <span>Integrasjoner</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/admin/timer")}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    <span>Timer</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    <User className="h-4 w-4" />
                    <span>{profile?.fornavn || user?.email}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => router.push("/min/profil")}>
                    <User className="h-4 w-4 mr-2" />
                    <span>Min profil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/min/uke/${getCurrentYear()}/${getCurrentWeek()}`)}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    <span>Min uke</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Logout Button */}
              <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logg ut</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Logg ut?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Er du sikker på at du vil logge ut av systemet?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                      Logg ut
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <span className="sr-only">Åpne meny</span>
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Meny</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-6">
            {/* Main navigation */}
            <Button
              variant={pathname === "/" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                router.push("/");
                setMobileMenuOpen(false);
              }}
            >
              <Home className="h-4 w-4 mr-2" />
              Hjem
            </Button>

            <Button
              variant={isActive("/admin/bemanningsliste") ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                router.push(`/admin/bemanningsliste/${getCurrentYear()}/${getCurrentWeek()}`);
                setMobileMenuOpen(false);
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Bemanningsliste
            </Button>

            <Button
              variant={isActive("/admin/rapporter") ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                router.push("/admin/rapporter/maanedlig");
                setMobileMenuOpen(false);
              }}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Rapporter
            </Button>

            <Button
              variant={isActive("/admin/settings") ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                router.push("/admin/settings");
                setMobileMenuOpen(false);
              }}
            >
              <Bell className="h-4 w-4 mr-2" />
              Innstillinger
            </Button>

            {/* Admin submenu */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-semibold text-muted-foreground mb-2 px-2">Admin</p>
              
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/admin/brukere");
                  setMobileMenuOpen(false);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Brukere
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/admin/integrasjoner");
                  setMobileMenuOpen(false);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Integrasjoner
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/admin/timer");
                  setMobileMenuOpen(false);
                }}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Timer
              </Button>
            </div>

            {/* User menu */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-semibold text-muted-foreground mb-2 px-2">
                {profile?.fornavn || user?.email}
              </p>
              
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/min/profil");
                  setMobileMenuOpen(false);
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Min profil
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push(`/min/uke/${getCurrentYear()}/${getCurrentWeek()}`);
                  setMobileMenuOpen(false);
                }}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Min uke
              </Button>
            </div>

            {/* Logout */}
            <div className="border-t pt-4 mt-2">
              <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logg ut
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Logg ut?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Er du sikker på at du vil logge ut av systemet?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                      Logg ut
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
