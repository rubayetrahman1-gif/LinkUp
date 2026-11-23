import { createContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "../types/auth";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  setUser: Dispatch<SetStateAction<User | null>>;
  refreshUser: () => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
