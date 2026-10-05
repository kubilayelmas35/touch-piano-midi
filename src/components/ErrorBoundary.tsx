import { Component, type ErrorInfo, type ReactNode } from "react";
import { tNow } from "../i18n";
import { reportError } from "../lib/errors";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[app] crashed", error);
    if (info.componentStack) error.stack = `${error.stack ?? ""}\n--- components ---${info.componentStack}`;
    reportError("crash", error);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center">
        <div className="glass max-w-sm rounded-3xl p-6">
          <h1 className="text-lg font-bold">{tNow("crashTitle")}</h1>
          <p className="mt-2 text-sm text-mist-300">{tNow("crashBody")}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-5 h-10 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-400"
          >
            {tNow("reload")}
          </button>
        </div>
      </div>
    );
  }
}
