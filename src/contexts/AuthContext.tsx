import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Profile } from '../lib/database.types';
import { api, AuthSession, AuthUser } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initializeDefaultAdmin: () => Promise<void>;
  updateProfileState: (profile: Profile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const applySession = (session: AuthSession) => {
    setUser(session.user);
    setProfile(session.profile);
  };

  const signIn = async (email: string, password: string) => {
    const session = await api.login(email, password);
    applySession(session);
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
    setProfile(null);
  };

  const initializeDefaultAdmin = async () => {
    try {
      await api.initializeDefaultAdmin();
    } catch (error) {
      console.error('Error initializing default admin:', error);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    initializeDefaultAdmin,
    updateProfileState: setProfile,
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
