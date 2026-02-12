// src/ui/ErrorBoundary.tsx
import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error("App crashed during render", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#07090c", color: "rgba(255,255,255,0.92)", padding: 24 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>App crashed during render</div>
          <div style={{ marginTop: 10, opacity: 0.85, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {this.state.error.message}
          </div>
          <div style={{ marginTop: 14, opacity: 0.7 }}>
            Check DevTools console for the stack trace.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}