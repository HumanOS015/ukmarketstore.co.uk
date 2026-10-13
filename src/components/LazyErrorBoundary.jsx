import { Component } from "react";

// Catches "Failed to fetch dynamically imported module" errors from lazy-loaded
// routes and shows a reload prompt instead of crashing the whole app.
export default class LazyErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    const isLazyLoadError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed");
    if (!isLazyLoadError) {
      // Re-throw non-lazy errors so they surface normally
      throw error;
    }
  }

  handleReload = () => {
    // Force a full page reload to re-fetch the module
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <p className="font-medium text-muted-foreground mb-1">
            Couldn't load this page
          </p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            A temporary loading issue occurred. Refreshing should fix it.
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}