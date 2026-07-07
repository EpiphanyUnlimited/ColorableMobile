import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary to prevent full-app crashes (black screen)
 * Catches React render errors and displays a recovery UI
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('React Error Boundary caught:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleClearAndReload = () => {
        // Clear localStorage to remove potentially corrupted data
        try {
            localStorage.removeItem('coloringbook_images');
            console.log('Cleared localStorage before reload');
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
        }
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '40px',
                        maxWidth: '500px',
                        textAlign: 'center',
                        color: 'white',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
                        <h1 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: '600' }}>
                            Something went wrong
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '24px', fontSize: '14px' }}>
                            An error occurred while processing your image. This can happen with very large images or temporary glitches.
                        </p>
                        {this.state.error && (
                            <details style={{
                                marginBottom: '24px',
                                textAlign: 'left',
                                background: 'rgba(0, 0, 0, 0.2)',
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                Reload App
                            </button>
                            <button
                                onClick={this.handleClearAndReload}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: 'white',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                Clear Data & Reload
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
