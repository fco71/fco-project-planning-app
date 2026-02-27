import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

type Mode = "signin" | "signup" | "forgot";

/**
 * Maps Firebase auth error codes to user-friendly messages.
 */
function getFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Authentication failed. Please try again.";

  const message = error.message.toLowerCase();

  // Firebase error codes are in the format: "Firebase: Error (auth/error-code)."
  if (message.includes("auth/wrong-password") || message.includes("auth/user-not-found") || message.includes("auth/invalid-credential")) {
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
  const { signIn, signUp, sendPasswordReset, envOk, missingEnv } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setErr(null);
    setResetSent(false);
  }

  const canSubmit = useMemo(() => {
    if (!envOk || busy) return false;
    const hasEmail = email.trim().length > 3;
    if (mode === "forgot") return hasEmail;
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
      } else if (mode === "forgot") {
        await sendPasswordReset(cleanEmail);
        setResetSent(true);
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
        <div className="auth-card" data-testid="auth-card">
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

  /* ── Forgot password view ─────────────────────────────────── */
  if (mode === "forgot") {
    return (
      <div className="auth-page">
        <div className="auth-card" data-testid="auth-card">
          <h1>FCO Planning App</h1>

          {resetSent ? (
            <div className="auth-reset-success">
              <p>
                ✉️ Reset link sent to <strong>{email.trim()}</strong>
              </p>
              <p className="auth-reset-hint">
                Check your inbox (and spam folder). The link expires in 1 hour.
              </p>
              <button
                type="button"
                className="auth-submit"
                onClick={() => switchMode("signin")}
                data-testid="auth-back-to-signin-button"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <p>Enter your email address and we'll send you a link to reset your password.</p>
              <form onSubmit={onSubmit} className="auth-form" data-testid="auth-forgot-form">
                <label>
                  Email
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    autoFocus
                  />
                </label>

                {err ? <div className="auth-error">{err}</div> : null}

                <button
                  disabled={!canSubmit}
                  type="submit"
                  className="auth-submit"
                  data-testid="auth-send-reset-button"
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>

                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => switchMode("signin")}
                  data-testid="auth-back-to-signin-button"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Sign in / Sign up view ───────────────────────────────── */
  return (
    <div className="auth-page">
      <div className="auth-card" data-testid="auth-card">
        <h1>FCO Planning App</h1>
        <p>Sign in or create your account to build your project trees.</p>

        <div className="auth-mode-tabs">
          <button
            type="button"
            className={mode === "signin" ? "is-active" : ""}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "is-active" : ""}
            onClick={() => switchMode("signup")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form" data-testid="auth-signin-form">
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

          {mode === "signin" && (
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => switchMode("forgot")}
              data-testid="auth-forgot-password-button"
            >
              Forgot password?
            </button>
          )}

          {err ? <div className="auth-error">{err}</div> : null}

          <button disabled={!canSubmit} type="submit" className="auth-submit" data-testid="auth-submit-button">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
