import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { api, TokenResponse, User, UserRole } from "./api";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    fullName: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_TOKEN = "drivebid_token";
const STORAGE_USER = "drivebid_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_USER);
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_USER);
      }
    }
  }, []);

  const persist = (res: TokenResponse) => {
    localStorage.setItem(STORAGE_TOKEN, res.access_token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(res.user));
    setUser(res.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    persist(res);
  }, []);

  const register = useCallback(
    async (email: string, fullName: string, password: string, role: UserRole) => {
      const res = await api.register({
        email,
        full_name: fullName,
        password,
        role,
      });
      persist(res);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout }),
    [user, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
