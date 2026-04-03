import type { User, UserData } from './types';

const USERS_KEY = 'fm_users';
const SESSION_KEY = 'fm_session';
const DATA_PREFIX = 'fm_data_';

export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function saveSession(userId: string): void {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getUserData(userId: string): UserData | null {
  try {
    const raw = localStorage.getItem(`${DATA_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserData(userId: string, data: UserData): void {
  localStorage.setItem(`${DATA_PREFIX}${userId}`, JSON.stringify(data));
}

export function deleteUserData(userId: string): void {
  localStorage.removeItem(`${DATA_PREFIX}${userId}`);
}
