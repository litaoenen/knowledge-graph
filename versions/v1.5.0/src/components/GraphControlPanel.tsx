import React from 'react';

interface GraphControlPanelProps {
  onAddNodeClick: () => void;
  onDeleteNodeClick: () => void;
  onTestClick?: () => void;
  nodeCount: number;
  edgeCount: number;
  showRelations: boolean;
  onToggleRelations: () => void;
}

export const GraphControlPanel: React.FC<GraphControlPanelProps> = ({
  onAddNodeClick,
  onDeleteNodeClick,
  onTestClick,
  nodeCount,
  edgeCount,
  showRelations,
  onToggleRelations
}) => {
  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <h3>控制面板</h3>
      </div>
      
      <div className="control-panel-stats">
        <div className="stat-item">
          <span className="stat-label">节点数量:</span>
          <span className="stat-value">{nodeCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">边数量:</span>
          <span className="stat-value">{edgeCount}</span>
        </div>
      </div>
      
      <div className="control-panel-actions">
        <button 
          className="button button-primary"
          onClick={onAddNodeClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加节点
        </button>
        
        <button 
          className="button button-danger"
          onClick={onDeleteNodeClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
          删除节点
        </button>
        
        {onTestClick && (
          <button 
            className="button button-secondary"
            onClick={onTestClick}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            测试
          </button>
        )}
      </div>
      
      <div className="control-panel-options">
        <div className="toggle-option">
          <label className="toggle-label">
            显示关联关系
            <input
              type="checkbox"
              checked={showRelations}
              onChange={onToggleRelations}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default GraphControlPanel; 