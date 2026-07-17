import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application context:', error, errorInfo);
  }

  public handleRecovery = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white border border-slate-100 shadow-xl shadow-slate-100/50 rounded-2xl p-8 flex flex-col items-center">
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-full inline-flex items-center justify-center mb-6">
              <ShieldAlert className="h-12 w-12 text-rose-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              An unexpected error occurred. You can attempt to reload the application to restore your session.
            </p>
            {this.state.error && (
              <pre className="w-full bg-slate-950 text-rose-400 p-4 rounded-xl text-left text-xs overflow-x-auto mb-6 max-h-40 font-mono">
                {this.state.error.name}: {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleRecovery} className="w-full py-2.5">
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
