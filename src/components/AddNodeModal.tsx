import React, { useEffect } from 'react';
import { KnowledgeNode, AbilityNode } from '../utils/excelReader';

interface AddNodeModalProps {
  showAddModal: boolean;
  setShowAddModal: (value: boolean) => void;
  nodeType: 'knowledge' | 'ability';
  setNodeType: (value: 'knowledge' | 'ability') => void;
  newNode: Partial<KnowledgeNode & AbilityNode>;
  setNewNode: (value: Partial<KnowledgeNode & AbilityNode>) => void;
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  selectedParentId: string;
  setSelectedParentId: (value: string) => void;
  customIdInput: boolean;
  setCustomIdInput: (value: boolean) => void;
  nextAvailableId: string;
  knowledgeNodes: KnowledgeNode[];
  abilityNodes: AbilityNode[];
  generateNextAvailableId: (parentId: string, type: 'knowledge' | 'ability') => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  showAddModal,
  setShowAddModal,
  nodeType,
  setNodeType,
  newNode,
  setNewNode,
  isEditMode,
  setIsEditMode,
  selectedParentId,
  setSelectedParentId,
  customIdInput,
  setCustomIdInput,
  nextAvailableId,
  knowledgeNodes,
  abilityNodes,
  generateNextAvailableId,
  onSubmit,
  onCancel
}) => {
  if (!showAddModal) return null;

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    setSelectedParentId(parentId);
    generateNextAvailableId(parentId, nodeType);
  };

  const handleCustomIdToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomIdInput(e.target.checked);
  };

  const updateNewNode = (field: string, value: any) => {
    const updatedNode = { ...newNode, [field]: value };
    setNewNode(updatedNode);
  };

  const handleTypeChange = (type: 'knowledge' | 'ability') => {
    setNodeType(type);
    generateNextAvailableId(selectedParentId, type);
  };

  // 所有父节点选项
  const parentOptions = nodeType === 'knowledge' 
    ? knowledgeNodes.map(node => ({ id: node.id, label: node.label }))
    : abilityNodes.map(node => ({ id: node.id, label: node.label }));

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <div className={`modal-icon ${isEditMode ? 'edit' : 'add'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isEditMode ? (
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              ) : (
                <>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </>
              )}
            </svg>
          </div>
          <h2 className="modal-title">
            {isEditMode ? '修改节点' : '添加新节点'}
          </h2>
        </div>
        
        <p className="modal-description">
          {isEditMode 
            ? '修改节点信息，保持ID不变。' 
            : '添加新节点到图谱中。请选择节点类型和填写必要信息。'}
        </p>
        
        {!isEditMode && (
          <div className="form-group">
            <label className="form-label">节点类型 <span className="required-mark">*</span></label>
            <div className="radio-group">
              <label 
                className={`radio-label ${nodeType === 'knowledge' ? 'selected' : ''}`}
                onClick={() => handleTypeChange('knowledge')}
              >
                <input 
                  type="radio" 
                  name="nodeType" 
                  className="radio-input"
                  checked={nodeType === 'knowledge'} 
                  onChange={() => {}} 
                />
                知识节点
              </label>
              <label 
                className={`radio-label ${nodeType === 'ability' ? 'selected' : ''}`}
                onClick={() => handleTypeChange('ability')}
              >
                <input 
                  type="radio" 
                  name="nodeType" 
                  className="radio-input"
                  checked={nodeType === 'ability'} 
                  onChange={() => {}} 
                />
                能力节点
              </label>
            </div>
          </div>
        )}
        
        {!isEditMode && (
          <div className="form-group">
            <label className="form-label">父节点 <span className="required-mark">*</span></label>
            <select 
              className="select-input"
              value={selectedParentId} 
              onChange={handleParentChange}
            >
              <option value="">-- 选择父节点 --</option>
              {parentOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.id})
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="form-group">
          <div className="id-group">
            <label className="form-label">节点ID <span className="required-mark">*</span></label>
            {!isEditMode && (
              <label className="custom-checkbox">
                <input 
                  type="checkbox" 
                  className="checkbox-input"
                  checked={customIdInput} 
                  onChange={handleCustomIdToggle} 
                />
                自定义ID
              </label>
            )}
          </div>
          
          <input 
            type="text" 
            className="text-input id-input"
            value={customIdInput ? newNode.id || '' : nextAvailableId}
            onChange={(e) => customIdInput && updateNewNode('id', e.target.value)}
            disabled={!customIdInput && !isEditMode}
            placeholder="节点ID" 
          />
          
          {!isEditMode && !customIdInput && (
            <p className="id-description">
              ID将自动生成，基于父节点ID和类型。
            </p>
          )}
        </div>
        
        <div className="form-group">
          <label className="form-label">节点名称 <span className="required-mark">*</span></label>
          <input 
            type="text" 
            className="text-input"
            value={newNode.label || ''} 
            onChange={(e) => updateNewNode('label', e.target.value)}
            placeholder="输入节点名称" 
          />
        </div>
        
        <div className="flex-row">
          <div className="flex-column">
            <label className="form-label">难度 (1-5)</label>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1"
              className="range-input"
              value={newNode.difficulty || 3} 
              onChange={(e) => updateNewNode('difficulty', parseInt(e.target.value))}
            />
          </div>
          
          <div className="flex-column">
            <label className="form-label">重要性 (1-5)</label>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1"
              className="range-input"
              value={newNode.importance || 3} 
              onChange={(e) => updateNewNode('importance', parseInt(e.target.value))}
            />
          </div>
        </div>
        
        {nodeType === 'ability' && (
          <div className="form-group">
            <label className="form-label">标签</label>
            <input 
              type="text" 
              className="text-input"
              value={(newNode as any).tag || ''} 
              onChange={(e) => updateNewNode('tag', e.target.value)}
              placeholder="输入标签，用逗号分隔多个标签" 
            />
          </div>
        )}
        
        <div className="form-group">
          <label className="form-label">描述</label>
          <textarea 
            className="textarea"
            value={newNode.description || ''} 
            onChange={(e) => updateNewNode('description', e.target.value)}
            placeholder="输入节点详细描述" 
          />
        </div>
        
        <div className="modal-footer">
          <button 
            className="button button-secondary"
            onClick={onCancel}
          >
            取消
          </button>
          <button 
            className="button button-primary"
            onClick={onSubmit}
          >
            {isEditMode ? '保存修改' : '添加节点'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddNodeModal; 