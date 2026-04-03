import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { User, UserSettings } from '../types';
import {
  getUsers,
  saveUsers,
  getSession,
  saveSession,
  clearSession,
  getUserData,
  saveUserData,
} from '../storage';
import { createSampleData } from '../sampleData';

interface AuthContextValue {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<Pick<User, 'username' | 'email' | 'passwordHash' | 'settings'>>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hashPassword(password: string): string {
  return btoa(password + 'fm_salt');
}

const DEMO_USER_EMAIL = 'demo@financemanager.fr';
const DEMO_USER_PASSWORD = 'demo1234';

function ensureDemoUser(): void {
  const users = getUsers();
  if (!users.find((u) => u.email === DEMO_USER_EMAIL)) {
    const demoUser: User = {
      id: 'demo-user-id',
      username: 'Utilisateur Demo',
      email: DEMO_USER_EMAIL,
      passwordHash: hashPassword(DEMO_USER_PASSWORD),
      settings: {
        theme: 'auto',
        currency: 'EUR',
      },
      createdAt: new Date().toISOString(),
    };
    const existing = getUserData('demo-user-id');
    if (!existing) {
      saveUserData('demo-user-id', createSampleData('demo-user-id'));
    }
    saveUsers([...users, demoUser]);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    ensureDemoUser();
    const sessionId = getSession();
    if (sessionId) {
      const users = getUsers();
      const user = users.find((u) => u.id === sessionId);
      if (user) setCurrentUser(user);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const users = getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!user) throw new Error('Aucun compte trouvé avec cet email.');
    if (user.passwordHash !== hashPassword(password)) {
      throw new Error('Mot de passe incorrect.');
    }
    saveSession(user.id);
    setCurrentUser(user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const users = getUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Un compte existe déjà avec cet email.');
    }
    const newUser: User = {
      id: uuidv4(),
      username,
      email,
      passwordHash: hashPassword(password),
      settings: {
        theme: 'auto',
        currency: 'EUR',
      },
      createdAt: new Date().toISOString(),
    };
    saveUsers([...users, newUser]);
    saveUserData(newUser.id, createSampleData(newUser.id));
    saveSession(newUser.id);
    setCurrentUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
  }, []);

  const updateUser = useCallback(
    (updates: Partial<Pick<User, 'username' | 'email' | 'passwordHash' | 'settings'>>) => {
      if (!currentUser) return;
      const users = getUsers();
      const updatedUser = { ...currentUser, ...updates };
      if (updates.settings) {
        updatedUser.settings = { ...currentUser.settings, ...updates.settings } as UserSettings;
      }
      saveUsers(users.map((u) => (u.id === currentUser.id ? updatedUser : u)));
      setCurrentUser(updatedUser);
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
