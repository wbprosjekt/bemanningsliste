import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MinUke from "./pages/MinUke";
import TripletexIntegration from "./pages/admin/integrasjoner/TripletexIntegration";
import Uke from "./pages/Uke";
import AdminTimer from "./pages/admin/Timer";
import AdminBrukere from "./pages/admin/Brukere";
import AdminUnderleverandorer from "./pages/admin/Underleverandorer";
import Bemanningsliste from "./pages/admin/Bemanningsliste";
import UserInviteSystem from "./components/UserInviteSystem";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/min/uke/:year/:week" element={<MinUke />} />
              <Route path="/uke/:year/:week" element={<Uke />} />
              <Route path="/admin/integrasjoner/tripletex" element={<TripletexIntegration />} />
              <Route path="/admin/timer" element={<AdminTimer />} />
              <Route path="/admin/brukere" element={<AdminBrukere />} />
              <Route path="/admin/underleverandorer" element={<AdminUnderleverandorer />} />
              <Route path="/admin/bemanningsliste/:year/:week" element={<Bemanningsliste />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;