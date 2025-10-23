"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.replace("/");
      }
    };

    checkUser();
  }, [router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Bruker eksisterer allerede",
            description: "Denne e-postadressen er allerede registrert. Prøv å logge inn i stedet.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registrering feilet",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Registrering vellykket",
          description: "Sjekk e-posten din for bekreftelseslenke.",
        });
      }
    } catch {
      toast({
        title: "En feil oppstod",
        description: "Prøv igjen senere.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Innlogging feilet",
          description: error.message,
          variant: "destructive",
        });
      } else {
        router.replace("/");
      }
    } catch {
      toast({
        title: "En feil oppstod",
        description: "Prøv igjen senere.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Feil ved sending av e-post",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "E-post sendt",
          description: "Sjekk e-posten din for lenke til å tilbakestille passordet.",
        });
        setShowForgotPassword(false);
      }
    } catch {
      toast({
        title: "En feil oppstod",
        description: "Prøv igjen senere.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">FieldNote</CardTitle>
          <CardDescription>Logg inn eller registrer deg for å komme i gang</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Logg inn</TabsTrigger>
              <TabsTrigger value="signup">Registrer</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {showForgotPassword ? (
                <div className="space-y-4">
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">E-post</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Din e-postadresse"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Sender e-post..." : "Send tilbakestillingslenke"}
                    </Button>
                  </form>
                  <div className="text-center">
                    <Button
                      variant="link"
                      onClick={() => setShowForgotPassword(false)}
                      className="text-sm"
                    >
                      Tilbake til innlogging
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-post</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Passord</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Logger inn..." : "Logg inn"}
                    </Button>
                  </form>
                  <div className="text-center">
                    <Button
                      variant="link"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm"
                    >
                      Glemt passordet?
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-post</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Passord</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Registrerer..." : "Registrer deg"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
