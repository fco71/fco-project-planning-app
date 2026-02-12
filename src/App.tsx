import React from "react";
import { useAuth } from "./auth/AuthProvider";
import LoginPage from "./pages/LoginPage";
import PlannerPage from "./pages/PlannerPage";

export default function App() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <div className="planner-empty-state">Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <h1>FCO Planning App</h1>
          <p>Editable planning trees with cross-reference bubbles.</p>
        </div>
        <button
          onClick={() => {
            signOut().catch(() => {
              // Ignore sign-out errors in UI.
            });
          }}
        >
          Sign out
        </button>
      </header>
      <div className="app-content">
        <PlannerPage user={user} />
      </div>
    </div>
  );
}
