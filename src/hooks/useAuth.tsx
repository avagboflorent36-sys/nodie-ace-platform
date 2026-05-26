import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "student";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isStudent: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | null) => {
    if (!uid) {
      setRoles([]);
      setRolesLoaded(true);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
    setRolesLoaded(true);
  };

  useEffect(() => {
    // Listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setRolesLoaded(false);
        // Defer DB call to avoid auth-listener deadlock
        setTimeout(() => { void loadRoles(newSession.user.id); }, 0);
      } else {
        setRoles([]);
        setRolesLoaded(true);
      }
    });

    // Then hydrate
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadRoles(data.session.user.id);
      } else {
        setRolesLoaded(true);
      }
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setRolesLoaded(true);
  };

  const refreshRoles = async () => {
    if (user) await loadRoles(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        rolesLoaded,
        roles,
        isAdmin: roles.includes("admin") || roles.includes("super_admin"),
        isStudent: roles.includes("student"),
        signOut,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
