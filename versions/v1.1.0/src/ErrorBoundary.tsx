import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新状态，以便下一次渲染显示降级UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 可以在此处记录错误信息
    console.error('图谱组件错误:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了fallback，则使用它，否则显示默认错误消息
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="error-message">
          <h3>应用程序发生错误</h3>
          <p>{this.state.error?.message || '未知错误'}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '8px 16px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '16px'
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 