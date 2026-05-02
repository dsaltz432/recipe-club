import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional label shown in the error card to identify which section failed */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { section } = this.props;

    return (
      <div className="flex items-center justify-center p-4 sm:p-8 min-h-[200px]">
        <div className="w-full max-w-md rounded-xl border border-purple-200 bg-purple-50 px-6 py-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
            <AlertTriangle className="h-6 w-6 text-purple-600" />
          </div>
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            {section ? `${section} failed to load` : "Something went wrong"}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            An unexpected error occurred. Try again or reload the page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={this.handleReset}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto border-purple-200 text-purple-700 hover:bg-purple-100"
              size="sm"
            >
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
