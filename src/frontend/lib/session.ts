const TOKEN_KEY = "aibidder.local.token";

type SafeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function getLocalStorage(): SafeStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage as unknown;
  if (!storage || typeof storage !== "object") {
    return null;
  }

  const candidate = storage as Record<string, unknown>;
  if (
    typeof candidate.getItem !== "function" ||
    typeof candidate.setItem !== "function" ||
    typeof candidate.removeItem !== "function"
  ) {
    return null;
  }

  return {
    getItem: (key) => (candidate.getItem as (name: string) => string | null).call(storage, key),
    setItem: (key, value) => (candidate.setItem as (name: string, next: string) => void).call(storage, key, value),
    removeItem: (key) => (candidate.removeItem as (name: string) => void).call(storage, key),
  };
}

export function getStorageItem(key: string): string | null {
  return getLocalStorage()?.getItem(key) ?? null;
}

export function setStorageItem(key: string, value: string) {
  getLocalStorage()?.setItem(key, value);
}

export function removeStorageItem(key: string) {
  getLocalStorage()?.removeItem(key);
}

export function getStoredToken(): string | null {
  return getStorageItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  setStorageItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  removeStorageItem(TOKEN_KEY);
}
