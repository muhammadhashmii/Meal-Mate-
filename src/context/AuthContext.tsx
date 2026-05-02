import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SIGNUP_COOLDOWN_MS = 90_000;
const SIGNUP_COOLDOWN_STORAGE_KEY = "mealmate_signup_cooldown_v1";
const LOCAL_AUTH_ENABLED =
  (import.meta.env.VITE_AUTH_MODE as string | undefined)?.toLowerCase() === "local";
const LOCAL_AUTH_USERS_KEY = "mealmate_local_auth_users_v1";
const LOCAL_AUTH_SESSION_KEY = "mealmate_local_auth_session_v1";

const getAuthRedirectUrl = () => {
  const envRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
  if (envRedirect && envRedirect.trim().length > 0) return envRedirect.trim();
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return undefined;
};

type SignupCooldownMap = Record<string, number>;
type LocalUserRecord = { email: string; password: string; fullName: string; createdAt: number };
type LocalUsersMap = Record<string, LocalUserRecord>;

const normalizeEmailKey = (email: string) => email.trim().toLowerCase();

const loadCooldowns = (): SignupCooldownMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SIGNUP_COOLDOWN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SignupCooldownMap;
  } catch {
    return {};
  }
};

const saveCooldowns = (cooldowns: SignupCooldownMap) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIGNUP_COOLDOWN_STORAGE_KEY, JSON.stringify(cooldowns));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
};

const getCooldownRemainingMs = (email: string) => {
  const key = normalizeEmailKey(email);
  const cooldowns = loadCooldowns();
  const lastAttempt = cooldowns[key] ?? 0;
  const elapsed = Date.now() - lastAttempt;
  return Math.max(0, SIGNUP_COOLDOWN_MS - elapsed);
};

const markSignupAttempt = (email: string) => {
  const key = normalizeEmailKey(email);
  const cooldowns = loadCooldowns();
  cooldowns[key] = Date.now();
  saveCooldowns(cooldowns);
};

const isRateLimitError = (err: any) => {
  const message = String(err?.message ?? "");
  const status = err?.status ?? err?.statusCode ?? err?.code;
  return (
    status === 429 ||
    /rate limit/i.test(message) ||
    /too many requests/i.test(message) ||
    /email rate/i.test(message)
  );
};

const isUserAlreadyExistsError = (err: any) => {
  const message = String(err?.message ?? "");
  return /already registered/i.test(message) || /user already exists/i.test(message);
};

const loadLocalUsers = (): LocalUsersMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as LocalUsersMap;
  } catch {
    return {};
  }
};

const saveLocalUsers = (users: LocalUsersMap) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
};

const loadLocalSessionEmail = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const email = (parsed as any)?.email;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
};

const saveLocalSessionEmail = (email: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (!email) window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    else window.localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify({ email }));
  } catch {
    // ignore
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (LOCAL_AUTH_ENABLED) {
      const email = loadLocalSessionEmail();
      if (email) {
        const users = loadLocalUsers();
        const record = users[normalizeEmailKey(email)];
        if (record) {
          setUser(
            {
              id: `local:${normalizeEmailKey(record.email)}`,
              email: record.email,
              user_metadata: { full_name: record.fullName },
            } as any
          );
        } else {
          saveLocalSessionEmail(null);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setSession(null);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const emailTrimmed = email.trim();
    const remainingMs = getCooldownRemainingMs(email);
    if (remainingMs > 0) {
      return {
        error: {
          message: `Please wait ${Math.ceil(remainingMs / 1000)}s before trying again.`,
        },
      };
    }

    markSignupAttempt(emailTrimmed);

    if (LOCAL_AUTH_ENABLED) {
      const key = normalizeEmailKey(emailTrimmed);
      const users = loadLocalUsers();
      if (users[key]) {
        return { error: { message: "User already exists. Please sign in." } };
      }
      users[key] = { email: emailTrimmed, password, fullName, createdAt: Date.now() };
      saveLocalUsers(users);
      saveLocalSessionEmail(emailTrimmed);
      setUser(
        {
          id: `local:${key}`,
          email: emailTrimmed,
          user_metadata: { full_name: fullName },
        } as any
      );
      setSession(null);
      return { error: null };
    }

    // Prefer backend-assisted signup (email pre-confirmed) when available,
    // but fall back to normal client signup so the app can run locally without any Supabase CLI/deploys.
    try {
      const { error: invokeError } = await supabase.functions.invoke("signup", {
        body: { email: emailTrimmed, password, fullName },
      });

      if (!invokeError) {
        // Now sign in immediately (account is created as already-confirmed in backend).
        const signInAttempt = await supabase.auth.signInWithPassword({ email: emailTrimmed, password });
        if (signInAttempt.error) return { error: signInAttempt.error };
        return { error: null };
      }
    } catch {
      // ignore and fall back
    }

    // Fallback: normal Supabase signup (may require email confirmation depending on project settings).
    // Always bind auth emails to the current app origin to avoid legacy hosts.
    const emailRedirectTo = getAuthRedirectUrl();
    const { error } = await supabase.auth.signUp({
      email: emailTrimmed,
      password,
      options: {
        data: { full_name: fullName },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error && (isRateLimitError(error) || isUserAlreadyExistsError(error))) {
      const signInAttempt = await supabase.auth.signInWithPassword({ email: emailTrimmed, password });
      if (!signInAttempt.error) return { error: null };
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (LOCAL_AUTH_ENABLED) {
      const key = normalizeEmailKey(email);
      const users = loadLocalUsers();
      const record = users[key];
      if (!record || record.password !== password) {
        return { error: { message: "Invalid credentials" } };
      }
      saveLocalSessionEmail(record.email);
      setUser(
        {
          id: `local:${key}`,
          email: record.email,
          user_metadata: { full_name: record.fullName },
        } as any
      );
      setSession(null);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error };
  };

  const signOut = async () => {
    if (LOCAL_AUTH_ENABLED) {
      saveLocalSessionEmail(null);
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
