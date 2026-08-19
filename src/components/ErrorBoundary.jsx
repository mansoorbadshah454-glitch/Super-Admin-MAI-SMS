import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Super Admin Uncaught Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    width: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0f172a',
                    padding: '2rem',
                    color: '#f8fafc',
                    fontFamily: 'system-ui, sans-serif'
                }}>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '2rem',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        maxWidth: '650px',
                        width: '100%',
                        textAlign: 'center',
                        backdropFilter: 'blur(12px)'
                    }}>
                        <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '0.5rem' }}>
                            Page Render Error
                        </h1>
                        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            An error occurred while loading this page:
                        </p>

                        <div style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            padding: '1rem',
                            borderRadius: '8px',
                            textAlign: 'left',
                            overflow: 'auto',
                            maxHeight: '200px',
                            fontSize: '0.85rem',
                            color: '#f87171',
                            fontFamily: 'monospace',
                            marginBottom: '1.5rem',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                        </div>

                        <button
                            onClick={() => {
                                window.location.href = '/';
                            }}
                            style={{
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <RefreshCw size={16} />
                            Reload Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
