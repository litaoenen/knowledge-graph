import React from 'react';

interface DeleteNodeModalProps {
  showDeleteModal: boolean;
  nodeToDelete: { id: string; label: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteNodeModal: React.FC<DeleteNodeModalProps> = ({
  showDeleteModal,
  nodeToDelete,
  onConfirm,
  onCancel
}) => {
  if (!showDeleteModal || !nodeToDelete) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-icon delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <h2 className="modal-title">删除节点</h2>
        </div>
        
        <div className="modal-body">
          <p className="warning-text">确定要删除以下节点吗？此操作不可撤销。</p>
          <div className="node-info">
            <strong>节点ID:</strong> {nodeToDelete.id}<br />
            <strong>节点名称:</strong> {nodeToDelete.label}
          </div>
          <p className="delete-note">
            注意：删除此节点将同时删除其所有子节点及相关联的边。
          </p>
        </div>
        
        <div className="modal-footer">
          <button 
            className="button button-secondary"
            onClick={onCancel}
          >
            取消
          </button>
          <button 
            className="button button-danger"
            onClick={onConfirm}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteNodeModal; 