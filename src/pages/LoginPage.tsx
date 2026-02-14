import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

type Mode = "signin" | "signup";

/**
 * Maps Firebase auth error codes to user-friendly messages.
 */
function getFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Authentication failed. Please try again.";

  const message = error.message.toLowerCase();

  // Firebase error codes are in the format: "Firebase: Error (auth/error-code)."
  if (message.includes("auth/wrong-password") || message.includes("auth/user-not-found")) {
    return "Incorrect email or password. Please try again.";
  }
  if (message.includes("auth/email-already-in-use")) {
    return "This email is already registered. Try signing in instead.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Please use at least 6 characters.";
  }
  if (message.includes("auth/invalid-email")) {
    return "Invalid email address. Please check and try again.";
  }
  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (message.includes("auth/network-request-failed")) {
    return "Network error. Please check your internet connection.";
  }
  if (message.includes("auth/user-disabled")) {
    return "This account has been disabled. Please contact support.";
  }
  if (message.includes("auth/requires-recent-login")) {
    return "Please sign out and sign in again to continue.";
  }

  // Default: show the original message but cleaned up
  return error.message || "Authentication failed. Please try again.";
}

export default function LoginPage() {
  const { signIn, signUp, envOk, missingEnv } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!envOk || busy) return false;
    const hasEmail = email.trim().length > 3;
    const hasPassword = password.length >= 6;
    if (mode === "signup") return hasEmail && hasPassword && displayName.trim().length >= 2;
    return hasEmail && hasPassword;
  }, [busy, displayName, email, envOk, mode, password]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setBusy(true);
    try {
      const cleanEmail = email.trim();
      if (mode === "signup") {
        await signUp(displayName, cleanEmail, password);
      } else {
        await signIn(cleanEmail, password);
      }
    } catch (error: unknown) {
      setErr(getFriendlyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!envOk) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Firebase is not configured</h1>
          <p>Missing env keys:</p>
          <ul>
            {missingEnv.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>FCO Planning App</h1>
        <p>Sign in or create your account to build your project trees.</p>

        <div className="auth-mode-tabs">
          <button
            type="button"
            className={mode === "signin" ? "is-active" : ""}
            onClick={() => {
              setMode("signin");
              setErr(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "is-active" : ""}
            onClick={() => {
              setMode("signup");
              setErr(null);
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                type="text"
                autoComplete="name"
                placeholder="Francisco Valdez"
              />
            </label>
          )}

          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
            />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
            />
          </label>

          {err ? <div className="auth-error">{err}</div> : null}

          <button disabled={!canSubmit} type="submit" className="auth-submit">
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
