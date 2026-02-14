import React, { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Reload the page to start fresh
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>⚠️ Something went wrong</h1>
            <p>The app encountered an unexpected error. Don't worry - your data is safe in Firebase.</p>

            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Error details</summary>
                <pre className="error-boundary-stack">
                  <code>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </code>
                </pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button onClick={this.handleReset} className="error-boundary-button">
                Reload App
              </button>
              <a href="/" className="error-boundary-link">
                Go to Home
              </a>
            </div>

            <p className="error-boundary-footer">
              If this persists, try clearing your browser cache or contacting support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
