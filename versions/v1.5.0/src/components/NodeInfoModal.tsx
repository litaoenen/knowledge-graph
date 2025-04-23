import React from 'react';
import { Node, Node3D } from '../types';

interface NodeInfoModalProps {
  show: boolean;
  onClose: () => void;
  node: Node | Node3D | null;
}

const NodeInfoModal: React.FC<NodeInfoModalProps> = ({ show, onClose, node }) => {
  if (!show || !node) return null;

  // 确定节点类型
  const isNode3D = 'nodeType' in node;
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon info">
            <i className="fas fa-info-circle"></i>
          </div>
          <h2 className="modal-title">节点信息</h2>
        </div>
        <div className="modal-body">
          <div className="node-info-grid">
            <div className="info-item">
              <span className="info-label">ID</span>
              <span className="info-value">{node.id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">类型</span>
              <span className="info-value">
                {isNode3D 
                  ? (node as Node3D).nodeType === 'knowledge' ? '知识点' : '能力点'
                  : (node as Node).type
                }
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">标签</span>
              <span className="info-value">{node.label}</span>
            </div>
            {isNode3D && (node as Node3D).tag && (
              <div className="info-item">
                <span className="info-label">标签</span>
                <span className="info-value">{(node as Node3D).tag}</span>
              </div>
            )}
            <div className="info-item full-width">
              <span className="info-label">描述</span>
              <div className="info-description">{node.description || '暂无描述'}</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="button button-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default NodeInfoModal; 