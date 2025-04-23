import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ToastContext } from './components/Toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  static contextType = ToastContext;
  context!: React.ContextType<typeof ToastContext>;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新状态，下次渲染将显示错误UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    console.error('错误边界捕获到错误:', error, errorInfo);
    this.setState({
      errorInfo
    });
    
    // 显示错误Toast通知
    if (this.context && this.context.showToast) {
      this.context.showToast(`应用发生错误: ${error.message}`, 'error');
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 显示自定义错误UI
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h2>应用程序发生错误</h2>
            <p>{this.state.error && this.state.error.toString()}</p>
            <div className="error-details">
              <pre>
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="reload-button"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    // 正常渲染子元素
    return this.props.children;
  }
}

export default ErrorBoundary; 