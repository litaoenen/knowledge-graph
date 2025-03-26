import React, { useState, lazy, Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';
import './index.css';

// 使用懒加载方式加载组件
const Graph = lazy(() => import('./Graph'));
const Graph3D = lazy(() => import('./Graph3D'));

function App() {
  // 默认使用3D视图
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 处理视图切换，添加错误处理
  const handleViewModeChange = (mode: '2D' | '3D') => {
    try {
      // 清除之前的错误
      setErrorMessage(null);
      setViewMode(mode);
    } catch (error) {
      // 捕获并显示错误
      setErrorMessage(`视图切换错误: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('View mode change error:', error);
    }
  };
  
  // 加载过程中显示的组件
  const renderLoader = () => (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div>加载中...</div>
    </div>
  );
  
  return (
    <div className="app-container">
      <div className="view-toggle-container">
        <button 
          className={`view-toggle-button ${viewMode === '2D' ? 'active' : ''}`}
          onClick={() => handleViewModeChange('2D')}
        >
          2D视图
        </button>
        <button 
          className={`view-toggle-button ${viewMode === '3D' ? 'active' : ''}`}
          onClick={() => handleViewModeChange('3D')}
        >
          3D视图
        </button>
      </div>
      
      <div className="graph-container">
        <h1 className="graph-title">知识图谱 - {viewMode}视图</h1>
        
        {/* 错误信息显示 */}
        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}
        
        <div className="graph-content">
          {/* 使用Suspense和错误边界包裹组件 */}
          <ErrorBoundary>
            <Suspense fallback={renderLoader()}>
              <div className="graph-wrapper">
                {viewMode === '2D' ? <Graph /> : <Graph3D />}
              </div>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default App;
