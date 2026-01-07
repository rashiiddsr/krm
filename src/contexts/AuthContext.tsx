import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Profile } from '../lib/database.types';
import { api, AuthSession, AuthUser } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileState: (profile: Profile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_STORAGE_KEY = 'krm.auth.session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as { session?: AuthSession; expiresAt?: number };
        if (parsed.session && parsed.expiresAt && Date.now() < parsed.expiresAt) {
          setUser(parsed.session.user);
          setProfile(parsed.session.profile);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch (error) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const applySession = (session: AuthSession) => {
    setUser(session.user);
    setProfile(session.profile);
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ session, expiresAt: Date.now() + SESSION_TTL_MS })
    );
  };

  const signIn = async (identifier: string, password: string) => {
    const session = await api.login(identifier, password);
    applySession(session);
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
    setProfile(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    updateProfileState: (nextProfile: Profile) => {
      setProfile(nextProfile);
      setUser((prevUser) => {
        if (prevUser) {
          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              session: { user: prevUser, profile: nextProfile },
              expiresAt: Date.now() + SESSION_TTL_MS,
            })
          );
        }
        return prevUser;
      });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
