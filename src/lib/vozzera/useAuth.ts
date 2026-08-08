import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vozzera:username";

/**
 * Não existe GET /api/me: a identidade só chega no login.
 * Guardamos o username no localStorage apenas para exibição
 * (não é credencial — a sessão real é o cookie HttpOnly).
 */
export function useAuth() {
  const [username, setUsernameState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUsernameState(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      /* storage indisponível */
    }
  }, []);

  const setUsername = useCallback((name: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* ignore */
    }
    setUsernameState(name);
  }, []);

  const clearUsername = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUsernameState(null);
  }, []);

  return { username, setUsername, clearUsername };
}
