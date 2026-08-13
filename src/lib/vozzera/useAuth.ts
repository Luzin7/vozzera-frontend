import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vozzera:username";

function readStoredUsername(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredUsername(name: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
    return true;
  } catch {
    return false;
  }
}

function clearStoredUsername(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function useAuth() {
  const [username, setUsernameState] = useState<string | null>(null);

  useEffect(() => {
    setUsernameState(readStoredUsername());
  }, []);

  const setUsername = useCallback((name: string) => {
    writeStoredUsername(name);
    setUsernameState(name);
  }, []);

  const clearUsername = useCallback(() => {
    clearStoredUsername();
    setUsernameState(null);
  }, []);

  return { username, setUsername, clearUsername };
}
