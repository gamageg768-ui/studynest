import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { User } from "../api/types";
import { authApi } from "../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    display_name: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("studynest_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem("studynest_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { token, user } = await authApi.login(username, password);
    localStorage.setItem("studynest_token", token);
    setUser(user);
  };

  const register = async (
    username: string,
    password: string,
    display_name: string
  ) => {
    const { token, user } = await authApi.register(
      username,
      password,
      display_name
    );
    localStorage.setItem("studynest_token", token);
    setUser(user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem("studynest_token");
    setUser(null);
  };

  const loginAsGuest = async () => {
    const { token, user } = await authApi.guestLogin();
    localStorage.setItem("studynest_token", token);
    setUser(user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
