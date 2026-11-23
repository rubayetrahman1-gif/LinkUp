import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser } from "../services/authService";
import type { User } from "../types/auth";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshUser = async () => {
    setLoading(true);
    setError("");

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (requestError) {
      setUser(null);
      const message = requestError instanceof Error
        ? requestError.message
        : "Could not verify your account.";
      setError(message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      if (!localStorage.getItem("access_token")) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (active) {
          setUser(currentUser);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setUser(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not verify your account.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "access_token" && event.key !== null) return;
      if (!event.newValue) {
        setUser(null);
        setError("");
        setLoading(false);
      } else {
        void refreshUser().catch(() => undefined);
      }
    };

    void restoreSession();
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, setUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
