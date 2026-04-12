import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  api,
  clearAuth,
  getStoredUser,
  persistAuth,
  TokenResponse,
  User,
  UserRole,
} from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    fullName: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoredUser()
      .then((u) => setUser(u))
      .finally(() => setLoading(false));
  }, []);

  const handle = useCallback(async (res: TokenResponse) => {
    await persistAuth(res);
    setUser(res.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      await handle(res);
    },
    [handle]
  );

  const register = useCallback(
    async (email: string, fullName: string, password: string, role: UserRole) => {
      const res = await api.register({
        email,
        full_name: fullName,
        password,
        role,
      });
      await handle(res);
    },
    [handle]
  );

  const logout = useCallback(async () => {
    await clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
