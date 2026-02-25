import { useAuth } from "./auth/AuthProvider";
import LoginPage from "./pages/LoginPage";
import PlannerPage from "./pages/PlannerPage";

function LoadingFallback() {
  return <div className="planner-empty-state">Loading...</div>;
}

export default function App() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <h1>FCO Planning App</h1>
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
