export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type AuthSession = {
  userId: string;
  fullName: string;
  email: string;
};

const USERS_KEY = "medical-record-insights-auth-users";
const SESSION_KEY = "medical-record-insights-auth-session";

function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadUsers() {
  return readJson<AuthUser[]>(USERS_KEY, []);
}

export function loadSession() {
  return readJson<AuthSession | null>(SESSION_KEY, null);
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

async function hashPassword(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function signUp(fullName: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = loadUsers();

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with that email already exists.");
  }

  const user: AuthUser = {
    id: `user-${Math.random().toString(36).slice(2, 10)}`,
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString()
  };

  writeJson(USERS_KEY, [...users, user]);

  const session: AuthSession = {
    userId: user.id,
    fullName: user.fullName,
    email: user.email
  };

  writeJson(SESSION_KEY, session);
  return session;
}

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const passwordHash = await hashPassword(password);
  const user = users.find((entry) => entry.email === normalizedEmail && entry.passwordHash === passwordHash);

  if (!user) {
    throw new Error("Email or password was incorrect.");
  }

  const session: AuthSession = {
    userId: user.id,
    fullName: user.fullName,
    email: user.email
  };

  writeJson(SESSION_KEY, session);
  return session;
}
