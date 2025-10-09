import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logAuthEvent, getRequestContext } from '@/lib/monitoring';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Set up auth state listener FIRST
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          try {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Log authentication events
            const context = getRequestContext();
            if (event === 'SIGNED_IN' && session?.user) {
              logAuthEvent('LOGIN_SUCCESS', {
                userId: session.user.id,
                email: session.user.email,
                event,
              }, {
                userId: session.user.id,
                ...context,
              });
            } else if (event === 'SIGNED_OUT') {
              logAuthEvent('LOGOUT', {
                event,
              }, context);
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
              logAuthEvent('TOKEN_REFRESH', {
                userId: session.user.id,
                event,
              }, {
                userId: session.user.id,
                ...context,
              });
            }
          } catch (error) {
            console.error('useAuth: Error in auth state change handler:', error);
            setLoading(false);
          }
        }
      );

      // THEN check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        } catch (error) {
          console.error('useAuth: Error in getSession handler:', error);
          setLoading(false);
        }
      }).catch((error) => {
        console.error('useAuth: Error getting session:', error);
        setLoading(false);
      });

      return () => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('useAuth: Error unsubscribing:', error);
        }
      };
    } catch (error) {
      console.error('useAuth: Error setting up auth listener:', error);
      setLoading(false);
    }
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};