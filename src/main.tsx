// src/main.tsx
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ui/ErrorBoundary";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";

window.addEventListener("unhandledrejection", (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  const reasonText = String(reason || "");
  const reasonType =
    reason && typeof reason === "object" && "type" in reason
      ? String((reason as { type?: unknown }).type || "")
      : "";
  const reasonTag = reason ? Object.prototype.toString.call(reason) : "";
  const isCustomEvent =
    reason instanceof CustomEvent
    || reasonTag === "[object CustomEvent]"
    || (reasonType && reasonTag === "[object Event]");
  if (isCustomEvent || reasonType.startsWith("planner-") || reasonText === "[object CustomEvent]") {
    event.preventDefault();
  }
});

function hideBootOverlay() {
  const boot = document.getElementById("boot");
  if (boot) boot.style.display = "none";
  const fatal = document.getElementById("fatal");
  if (fatal) fatal.style.display = "none";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);

// If React mounted, kill the HTML boot overlay immediately.
hideBootOverlay();
