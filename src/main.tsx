// src/main.tsx
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
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

function showPwaToast(message: string) {
  const existing = document.getElementById("pwa-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "pwa-toast";
  toast.textContent = message;
  toast.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:9999",
    "padding:10px 12px",
    "border-radius:10px",
    "border:1px solid rgba(120,170,255,0.35)",
    "background:rgba(10,20,30,0.92)",
    "color:rgba(255,255,255,0.9)",
    "font:600 12px/1.4 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial",
    "letter-spacing:0.2px",
    "backdrop-filter:blur(6px)",
  ].join(";");
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 6000);
}

function dispatchPwaEvent(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);

registerSW({
  immediate: true,
  onOfflineReady() {
    showPwaToast("Offline ready.");
    dispatchPwaEvent("planner-offline-ready");
  },
  onNeedRefresh() {
    showPwaToast("Update ready. Reload to refresh.");
    dispatchPwaEvent("planner-update-ready");
  },
});

// If React mounted, kill the HTML boot overlay immediately.
hideBootOverlay();
