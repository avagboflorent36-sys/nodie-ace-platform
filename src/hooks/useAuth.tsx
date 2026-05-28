import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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

  // Track last-known values to avoid noisy re-renders on TOKEN_REFRESHED etc.
  const lastAccessTokenRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

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
      const newToken = newSession?.access_token ?? null;
      const newUid = newSession?.user?.id ?? null;

      // Skip if nothing meaningful changed (e.g. silent token refresh w/ same user)
      if (newToken === lastAccessTokenRef.current && newUid === lastUserIdRef.current) {
        return;
      }

      const uidChanged = newUid !== lastUserIdRef.current;
      lastAccessTokenRef.current = newToken;
      lastUserIdRef.current = newUid;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (uidChanged) {
        if (newUid) {
          // Defer DB call to avoid auth-listener deadlock; keep previous roles
          // visible during refetch to avoid flashing the auth gate.
          setTimeout(() => { void loadRoles(newUid); }, 0);
        } else {
          setRoles([]);
          setRolesLoaded(true);
        }
      }
    });

    // Then hydrate
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      lastAccessTokenRef.current = s?.access_token ?? null;
      lastUserIdRef.current = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadRoles(s.user.id);
      } else {
        setRolesLoaded(true);
      }
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    lastAccessTokenRef.current = null;
    lastUserIdRef.current = null;
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
