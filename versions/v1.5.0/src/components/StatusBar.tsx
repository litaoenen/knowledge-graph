import React from 'react';

interface StatusBarProps {
  nodeCount: number;
  edgeCount: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ nodeCount, edgeCount }) => {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">节点数量:</span>
        <span className="status-value">{nodeCount}</span>
      </div>
      <div className="status-separator"></div>
      <div className="status-item">
        <span className="status-label">关系数量:</span>
        <span className="status-value">{edgeCount}</span>
      </div>
    </div>
  );
};

export default StatusBar; 