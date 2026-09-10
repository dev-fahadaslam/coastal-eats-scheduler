import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../api/client.js';
import type { User } from '../api/types.js';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (userId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(userId: string) {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { userId });
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
