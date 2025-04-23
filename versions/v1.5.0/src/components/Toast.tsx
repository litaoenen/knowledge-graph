import React, { useEffect, useState } from 'react';

export interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error';
  onClose: (id: string) => void;
  autoClose?: boolean;
  duration?: number;
}

export interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

// 单个Toast组件
const Toast: React.FC<ToastProps> = ({ 
  id, 
  message, 
  type, 
  onClose, 
  autoClose = true, 
  duration = 3000 
}) => {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [id, onClose, autoClose, duration]);
  
  return (
    <div 
      className={`toast ${type}`}
      style={{
        backgroundColor: type === 'success' ? '#22c55e' : '#ef4444',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        margin: '10px 0',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        animation: 'toast-fade-in 0.3s ease-out',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '350px'
      }}
    >
      <div className="toast-icon" style={{ marginRight: '12px' }}>
        {type === 'success' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        )}
      </div>
      <span className="toast-message" style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
        {message}
      </span>
      <button
        onClick={() => onClose(id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          opacity: 0.7,
          cursor: 'pointer',
          padding: '5px',
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
};

// Toast容器组件
const ToastContainer: React.FC<ToastContainerProps> = ({ 
  toasts, 
  position = 'top-right' 
}) => {
  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'top-right':
        return {
          top: '20px',
          right: '20px',
        };
      case 'top-left':
        return {
          top: '20px',
          left: '20px',
        };
      case 'bottom-right':
        return {
          bottom: '20px',
          right: '20px',
        };
      case 'bottom-left':
        return {
          bottom: '20px',
          left: '20px',
        };
      default:
        return {
          top: '20px',
          right: '20px',
        };
    }
  };

  return (
    <div 
      className="toast-container"
      style={{
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        zIndex: 9999,
        ...getPositionStyles(),
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
};

// Toast上下文
interface ToastContextProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  hideToast: (id: string) => void;
}

export const ToastContext = React.createContext<ToastContextProps>({
  showToast: () => {},
  hideToast: () => {},
});

// Toast提供程序
export const ToastProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, onClose: hideToast }]);
  };

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};

// 自定义Hook，用于在组件中使用Toast
export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export { Toast, ToastContainer }; 