import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="dashboard-card" style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-error)',
          borderRadius: '8px',
          margin: '1rem'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ color: 'var(--text-error)', marginBottom: '1rem' }}>
            Something went wrong
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {this.props.fallbackMessage || 'This component failed to load properly.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="px-md py-sm bg-primary-gradient text-white rounded-sm hover-lift transition"
          >
            Try Again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '4px',
              textAlign: 'left'
            }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                Error Details (Development)
              </summary>
              <pre style={{
                fontSize: '0.75rem',
                color: 'var(--text-error)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;