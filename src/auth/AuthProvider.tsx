// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, envOk, missingEnv, offlineMode } from "../firebase";

export type AuthState = {
  user: User | null;
  loading: boolean;
  envOk: boolean;
  missingEnv: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(offlineMode ? ({ uid: "offline" } as User) : null);
  const [loading, setLoading] = useState<boolean>(!offlineMode && envOk && !!auth);

  useEffect(() => {
    if (offlineMode || !envOk || !auth) return undefined;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  async function signIn(email: string, password: string) {
    if (offlineMode) return;
    if (!envOk || !auth) {
      throw new Error(`Firebase env missing: ${missingEnv.join(", ")}`);
    }
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(displayName: string, email: string, password: string) {
    if (offlineMode) return;
    if (!envOk || !auth || !db) {
      throw new Error(`Firebase env missing: ${missingEnv.join(", ")}`);
    }
    const cleanName = displayName.trim();
    if (!cleanName) throw new Error("Display name is required.");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: cleanName });
    await setDoc(
      doc(db, "users", credential.user.uid),
      {
        displayName: cleanName,
        email: credential.user.email || email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function signOut() {
    if (offlineMode) return;
    if (!auth) return;
    await fbSignOut(auth);
  }

  async function sendPasswordReset(email: string) {
    if (offlineMode) return;
    if (!envOk || !auth) {
      throw new Error(`Firebase env missing: ${missingEnv.join(", ")}`);
    }
    await sendPasswordResetEmail(auth, email.trim());
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      envOk: offlineMode ? true : envOk,
      missingEnv: offlineMode ? [] : missingEnv,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
    }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
