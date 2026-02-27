import { Suspense, lazy } from "react";
import { useAuth } from "./auth/AuthProvider";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const PlannerPage = lazy(() => import("./pages/PlannerPage"));

function LoadingFallback() {
  return (
    <div className="planner-loading-state" role="status" aria-live="polite">
      <span className="planner-loading-spinner" aria-hidden="true" />
      <span>Loading...</span>
    </div>
  );
}

export default function App() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    );
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
          data-testid="app-signout-button"
        >
          Sign out
        </button>
      </header>
      <div className="app-content">
        <Suspense fallback={<LoadingFallback />}>
          <PlannerPage user={user} />
        </Suspense>
      </div>
    </div>
  );
}
