import React, { useRef, useEffect, useState } from 'react';
import cytoscape, { NodeSingular, NodeDataDefinition, LayoutOptions } from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent'; // 更智能的布局算法
import { KnowledgeNode, AbilityNode, readExcelFile, readAbilityExcelFile } from './utils/excelReader';

// 注册布局引擎
cytoscape.use(coseBilkent);

interface NodeData extends NodeDataDefinition {
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
  nodeType?: 'knowledge' | 'ability'; // 添加节点分类
  tag?: string; // 添加标签字段
}

// 根据ID长度确定节点类型
const getNodeType = (id: string): string => {
  if (id === 'DS' || (id.startsWith('DS') && id.length <= 4)) return 'chapter';
  if (id.startsWith('DS') && id.length <= 6) return 'section';
  if (id.startsWith('DS') && id.length <= 8) return 'subsection';
  if (id.startsWith('DS') && id.length <= 10) return 'point';
  if (id === 'AB' || (id.startsWith('AB') && id.length <= 4)) return 'chapter';
  if (id.startsWith('AB') && id.length <= 6) return 'section';
  if (id.startsWith('AB') && id.length <= 8) return 'subsection';
  if (id.startsWith('AB') && id.length <= 10) return 'point';
  return 'detail';
};

// 创建边的关系
const createEdges = (nodes: (KnowledgeNode | AbilityNode)[]) => {
  const edges: { data: { source: string, target: string, id: string } }[] = [];
  
  // 创建节点ID的查找集合，用于快速检查节点是否存在
  const nodeIds = new Set(nodes.map(node => node.id));
  
  nodes.forEach(node => {
    if (node.id === 'DS' || node.id === 'AB') return; // 跳过根节点
    
    // 获取父节点ID
    let parentId: string;
    if ((node.id.startsWith('DS') || node.id.startsWith('AB')) && node.id.length > 2) {
      parentId = node.id.slice(0, -2);
      // 确保parentId有效
      if (parentId === '') {
        parentId = node.id.startsWith('DS') ? 'DS' : 'AB'; // 如果截取后为空，则父节点为DS或AB
      }
    } else {
      return; // 跳过不符合规则的节点
    }
    
    // 只有当父节点存在时才创建边
    if (nodeIds.has(parentId)) {
      edges.push({ 
        data: { 
          source: parentId, 
          target: node.id,
          id: `${parentId}-${node.id}`
        } 
      });
    }
  });
  
  console.log(`创建了 ${edges.length} 条边`); // 调试日志
  return edges;
};

const styles = {
  container: {
    width: '100%',
    height: '80vh',
    position: 'relative' as const,
  },
  loadingContainer: {
    width: '100%',
    height: '80vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    color: '#2c3e50',
    borderRadius: '12px',
    fontSize: '18px',
  },
  errorContainer: {
    width: '100%',
    height: '80vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    color: '#e74c3c',
    borderRadius: '12px',
    fontSize: '18px',
  }
};

// 添加全局样式
const GlobalStyles = `
  .node-tooltip {
    position: fixed;
    background: rgba(15, 23, 42, 0.9);
    border: none;
    border-radius: 12px;
    padding: 16px;
    color: #fff;
    font-size: 14px;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    max-width: 300px;
    animation: tooltip-fade-in 0.2s ease-out;
    transform-origin: center left;
  }

  @keyframes tooltip-fade-in {
    from { opacity: 0; transform: translateY(10px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .node-tooltip .tooltip-header {
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 8px;
    display: flex;
    align-items: center;
  }

  .node-tooltip .tooltip-header::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--dot-color, #3a86ff);
    margin-right: 8px;
  }

  .node-tooltip .tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .node-tooltip .tooltip-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Arial', sans-serif;
  }

  .node-tooltip .tooltip-item .label {
    color: rgba(255, 255, 255, 0.7);
    margin-right: 8px;
    font-size: 13px;
  }

  .node-tooltip .tooltip-item .value {
    color: #fff;
    font-weight: 500;
  }

  .node-tooltip .tooltip-description {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .node-tooltip .tooltip-description .label {
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 6px;
    font-size: 13px;
  }

  .node-tooltip .tooltip-description .value {
    color: #fff;
    line-height: 1.5;
    font-size: 14px;
  }
  
  /* 操作面板样式 */
  .control-panel {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 9999;
  }
  
  /* 消息提示样式 */
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 300px;
    z-index: 10000;
  }
  
  .toast {
    margin-bottom: 10px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    animation: toast-slide-in 0.3s ease-out forwards;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .toast-success {
    background-color: #10b981;
  }
  
  .toast-error {
    background-color: #ef4444;
  }
  
  @keyframes toast-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  /* 操作按钮样式 */
  .graph-button {
    padding: 8px 15px;
    margin-bottom: 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
    width: 100%;
    text-align: center;
  }
  
  .add-button {
    background-color: #10b981;
    color: white;
  }
  
  .delete-button {
    background-color: #ef4444;
    color: white;
  }
  
  /* 模态框样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    width: 400px;
    max-width: 90%;
  }
  
  .modal-title {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 15px;
  }
  
  .form-label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  
  .form-input {
    width: 100%;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  
  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }
  
  .highlighted-node {
    border-width: 5px !important;
    border-color: #FF9500 !important;
    z-index: 999 !important;
  }
  
  .highlighted-edge {
    width: 3px !important;
    line-color: #FF9500 !important;
    target-arrow-color: #FF9500 !important;
    z-index: 999 !important;
  }
`;

const Graph = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [abilityNodes, setAbilityNodes] = useState<AbilityNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // 添加节点操作相关状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [nodeType, setNodeType] = useState<'knowledge' | 'ability'>('knowledge');
  const [newNode, setNewNode] = useState<Partial<KnowledgeNode & AbilityNode>>({
    id: '',
    label: '',
    difficulty: 0.5,
    importance: 0.5,
    description: '',
    tag: ''
  });
  const [nodeToDelete, setNodeToDelete] = useState('');
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error'}[]>([]);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  
  // 添加用于父节点选择的状态
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [customIdInput, setCustomIdInput] = useState<boolean>(false);
  const [nextAvailableId, setNextAvailableId] = useState<string>('');
  
  // 显示提示消息
  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // 3秒后自动移除
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };
  
  // 高亮节点及其子节点
  const highlightNode = (nodeId: string) => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    const nodesToHighlight = new Set<string>();
    
    // 添加当前节点
    nodesToHighlight.add(nodeId);
    
    // 查找所有子节点
    cy.nodes().forEach(node => {
      if (node.id().startsWith(nodeId) && node.id() !== nodeId) {
        nodesToHighlight.add(node.id());
      }
    });
    
    // 设置高亮样式
    cy.batch(() => {
      nodesToHighlight.forEach(id => {
        const node = cy.getElementById(id);
        if (node.length > 0) {
          node.addClass('highlighted-node');
          
          // 高亮与该节点相关的边
          node.connectedEdges().addClass('highlighted-edge');
        }
      });
    });
    
    // 保存高亮的节点，3秒后自动移除高亮
    setHighlightedNodes(nodesToHighlight);
    setTimeout(() => {
      cy.batch(() => {
        nodesToHighlight.forEach(id => {
          const node = cy.getElementById(id);
          if (node.length > 0) {
            node.removeClass('highlighted-node');
            node.connectedEdges().removeClass('highlighted-edge');
          }
        });
      });
      setHighlightedNodes(new Set());
    }, 3000);
  };
  
  // 添加节点
  const addNode = () => {
    // 验证基本输入
    if (!newNode.id || !newNode.label) {
      showToast('请填写节点编号和名称', 'error');
      return;
    }
    
    // 验证父节点选择
    if (!selectedParentId && !customIdInput) {
      showToast('请选择父节点', 'error');
      return;
    }
    
    // 检查节点ID是否已存在
    const existingKnowledgeNode = knowledgeNodes.find(node => node.id === newNode.id);
    const existingAbilityNode = abilityNodes.find(node => node.id === newNode.id);
    
    if (existingKnowledgeNode || existingAbilityNode) {
      showToast(`节点编号 ${newNode.id} 已存在`, 'error');
      return;
    }
    
    // 验证自定义ID的格式
    if (customIdInput) {
      const nodeId = newNode.id as string;
      const rootPrefix = nodeType === 'knowledge' ? 'DS' : 'AB';
      
      // 检查ID格式
      if (!nodeId.startsWith(rootPrefix)) {
        showToast(`节点编号必须以${rootPrefix}开头`, 'error');
        return;
      }
      
      // 检查编号长度是否合法（应该是父节点长度+2）
      if (selectedParentId) {
        if (nodeId.length !== selectedParentId.length + 2) {
          showToast(`节点编号长度应该为父节点长度+2`, 'error');
          return;
        }
        
        // 检查是否以父节点ID为前缀
        if (!nodeId.startsWith(selectedParentId)) {
          showToast(`节点编号必须以所选父节点ID为前缀`, 'error');
          return;
        }
      } else {
        // 如果没有选择父节点，但使用自定义ID，检查编号格式
        if (nodeId !== rootPrefix && !nodeId.match(new RegExp(`^${rootPrefix}\\d{2}$`))) {
          showToast(`自定义根节点下的节点编号格式应为${rootPrefix}XX（X为数字）`, 'error');
          return;
        }
      }
    }
    
    const nodeId = newNode.id as string; // 使用类型断言确保id不为undefined
    const nodeTypeFromId = getNodeType(nodeId) as 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
    
    // 检查是否有子节点需要连接
    const hasExistingChildren = () => {
      if (nodeType === 'knowledge') {
        return knowledgeNodes.some(node => 
          node.id !== nodeId && 
          node.id.startsWith(nodeId) && 
          node.id.length === nodeId.length + 2
        );
      } else {
        return abilityNodes.some(node => 
          node.id !== nodeId && 
          node.id.startsWith(nodeId) && 
          node.id.length === nodeId.length + 2
        );
      }
    };
    
    if (nodeType === 'knowledge') {
      const newKnowledgeNode: KnowledgeNode = {
        id: nodeId,
        label: newNode.label as string,
        type: nodeTypeFromId,
        difficulty: newNode.difficulty || 0.5,
        importance: newNode.importance || 0.5,
        description: newNode.description
      };
      
      setKnowledgeNodes(prev => [...prev, newKnowledgeNode]);
      
      // 检查是否有子节点需要连接
      const existingChildren = hasExistingChildren();
      
      // 如果是新增节点，需要展开其父节点 (现在可以从selectedParentId获取)
      const parentId = selectedParentId || (nodeId.length > 2 ? nodeId.slice(0, -2) : '');
      
      if (parentId) {
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          newSet.add(parentId);
          if (parentId.length > 2) {
            const grandParentId = parentId.slice(0, -2);
            if (grandParentId) newSet.add(grandParentId);
          }
          if (nodeId.startsWith('DS')) newSet.add('DS');
          // 如果有子节点，默认展开当前节点
          if (existingChildren) {
            newSet.add(nodeId);
          }
          return newSet;
        });
      } else if (existingChildren) {
        // 如果是根节点且有子节点，则默认展开
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          newSet.add(nodeId);
          return newSet;
        });
      }
      
      if (existingChildren) {
        showToast(`成功添加知识节点: ${newNode.label} 并连接到现有子节点`, 'success');
      } else {
        showToast(`成功添加知识节点: ${newNode.label}`, 'success');
      }
    } else {
      const newAbilityNode: AbilityNode = {
        id: nodeId,
        label: newNode.label as string,
        name: newNode.label as string,
        type: nodeTypeFromId,
        difficulty: newNode.difficulty || 0.5,
        importance: newNode.importance || 0.5,
        description: newNode.description,
        tag: newNode.tag
      };
      
      setAbilityNodes(prev => [...prev, newAbilityNode]);
      
      // 检查是否有子节点需要连接
      const existingChildren = hasExistingChildren();
      
      // 如果是新增节点，需要展开其父节点 (现在可以从selectedParentId获取)
      const parentId = selectedParentId || (nodeId.length > 2 ? nodeId.slice(0, -2) : '');
      
      if (parentId) {
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          newSet.add(parentId);
          if (parentId.length > 2) {
            const grandParentId = parentId.slice(0, -2);
            if (grandParentId) newSet.add(grandParentId);
          }
          if (nodeId.startsWith('AB')) newSet.add('AB');
          // 如果有子节点，默认展开当前节点
          if (existingChildren) {
            newSet.add(nodeId);
          }
          return newSet;
        });
      } else if (existingChildren) {
        // 如果是根节点且有子节点，则默认展开
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          newSet.add(nodeId);
          return newSet;
        });
      }
      
      if (existingChildren) {
        showToast(`成功添加能力节点: ${newNode.label} 并连接到现有子节点`, 'success');
      } else {
        showToast(`成功添加能力节点: ${newNode.label}`, 'success');
      }
    }
    
    // 保存当前节点ID用于高亮
    const nodeIdToHighlight = nodeId;
    
    // 重置表单并关闭模态框
    resetAddNodeForm();
    
    // 在添加完成后高亮新节点
    setTimeout(() => {
      if (cyRef.current) {
        highlightNode(nodeIdToHighlight);
      }
    }, 500);
  };
  
  // 删除节点
  const deleteNode = () => {
    if (!nodeToDelete) {
      showToast('请输入要删除的节点编号', 'error');
      return;
    }
    
    // 检查节点是否存在
    const knowledgeNodeIndex = knowledgeNodes.findIndex(node => node.id === nodeToDelete);
    const abilityNodeIndex = abilityNodes.findIndex(node => node.id === nodeToDelete);
    
    if (knowledgeNodeIndex === -1 && abilityNodeIndex === -1) {
      showToast(`节点编号 ${nodeToDelete} 不存在`, 'error');
      return;
    }
    
    let nodeName = '';
    
    if (knowledgeNodeIndex !== -1) {
      nodeName = knowledgeNodes[knowledgeNodeIndex].label;
      
      // 检查是否有子节点
      const hasChildren = knowledgeNodes.some(node => 
        node.id !== nodeToDelete && 
        node.id.startsWith(nodeToDelete) && 
        node.id.length === nodeToDelete.length + 2
      );
      
      if (hasChildren) {
        showToast(`已删除知识节点: ${nodeName}，其子节点保留等待重新连接`, 'success');
      } else {
        showToast(`成功删除知识节点: ${nodeName}`, 'success');
      }
      
      setKnowledgeNodes(prev => prev.filter(node => node.id !== nodeToDelete));
      
    } else if (abilityNodeIndex !== -1) {
      nodeName = abilityNodes[abilityNodeIndex].label;
      
      // 检查是否有子节点
      const hasChildren = abilityNodes.some(node => 
        node.id !== nodeToDelete && 
        node.id.startsWith(nodeToDelete) && 
        node.id.length === nodeToDelete.length + 2
      );
      
      if (hasChildren) {
        showToast(`已删除能力节点: ${nodeName}，其子节点保留等待重新连接`, 'success');
      } else {
        showToast(`成功删除能力节点: ${nodeName}`, 'success');
      }
      
      setAbilityNodes(prev => prev.filter(node => node.id !== nodeToDelete));
    }
    
    // 移除被删除节点的展开状态，确保后续重新添加时不会有意外的展开状态
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeToDelete);
      return newSet;
    });
    
    // 重置删除表单并关闭模态框
    setNodeToDelete('');
    setShowDeleteModal(false);
    
    // 如果当前图已经渲染，需要立即更新
    setTimeout(() => {
      if (cyRef.current) {
        // 使用 batch 操作提高性能
        cyRef.current.batch(() => {
          // 移除节点，Cytoscape会自动移除相关的边
          const nodeToRemove = cyRef.current?.getElementById(nodeToDelete);
          if (nodeToRemove && nodeToRemove.length > 0) {
            nodeToRemove.remove();
          }
        });
      }
    }, 100);
  };

  // 加载 Excel 文件
  useEffect(() => {
    const loadExcelData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 加载知识图谱数据
        const knowledgeResponse = await fetch('/knowledge_graph.xlsx');
        if (!knowledgeResponse.ok) {
          throw new Error('知识图谱Excel文件加载失败');
        }
        const knowledgeArrayBuffer = await knowledgeResponse.arrayBuffer();
        const knowledgeData = await readExcelFile(knowledgeArrayBuffer);
        if (!knowledgeData || knowledgeData.length === 0) {
          throw new Error('知识图谱Excel文件为空或格式不正确');
        }
        setKnowledgeNodes(knowledgeData);
        
        // 加载能力图谱数据
        const abilityResponse = await fetch('/ability_graph.xlsx');
        if (!abilityResponse.ok) {
          throw new Error('能力图谱Excel文件加载失败');
        }
        const abilityArrayBuffer = await abilityResponse.arrayBuffer();
        const abilityData = await readAbilityExcelFile(abilityArrayBuffer);
        if (!abilityData || abilityData.length === 0) {
          throw new Error('能力图谱Excel文件为空或格式不正确');
        }
        setAbilityNodes(abilityData);
      } catch (error) {
        console.error('Failed to load Excel files:', error);
        setError(error instanceof Error ? error.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    loadExcelData();
  }, []);

  // 初始化图谱
  useEffect(() => {
    if (!containerRef.current || loading || error || (knowledgeNodes.length === 0 && abilityNodes.length === 0)) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }
    
    // 合并知识节点和能力节点
    const combinedNodes = [
      ...knowledgeNodes.map(node => ({
        data: { 
          ...node,
          isRoot: node.id === 'DS' || node.id.length <= 4,
          type: getNodeType(node.id),
          nodeType: 'knowledge' as const
        }
      })),
      ...abilityNodes.map(node => ({
        data: { 
          ...node,
          isRoot: node.id === 'AB' || node.id.length <= 4,
          type: getNodeType(node.id),
          nodeType: 'ability' as const
        }
      }))
    ];
    
    // 创建边
    const edges = createEdges([...knowledgeNodes, ...abilityNodes]);

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...combinedNodes,
        ...edges
      ],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-y': 0,
            'font-family': 'Arial',
            'font-size': '20px',
            'color': '#FFFFFF',
            'text-outline-width': 2,
            'text-outline-color': '#000000',
            'text-outline-opacity': 1,
            'text-background-opacity': 0,
            'width': (ele: NodeSingular) => {
              // 根据注册资本(importance)等比缩放
              const capital = ele.data('importance') || 0.5;
              // 映射到60px-150px范围
              return 60 + (capital * 90);
            },
            'height': (ele: NodeSingular) => {
              const capital = ele.data('importance') || 0.5;
              return 60 + (capital * 90);
            },
            'shape': 'ellipse',
            'background-color': (ele: NodeSingular) => {
              // 根据节点类型设置颜色
              const nodeType = ele.data('nodeType');
              const type = ele.data('type');
              
              // 知识节点和能力节点使用不同的颜色方案
              if (nodeType === 'knowledge') {
                if (type === 'chapter' || type === 'section') return '#3a86ff';
                return '#ff006e';
              } else { // ability节点
                if (type === 'chapter' || type === 'section') return '#00b894';
                return '#fdcb6e';
              }
            },
            'background-opacity': 0.85,
            'border-width': 3,
            'border-color': '#fff',
            'border-opacity': 0.9,
            'transition-property': 'width, height, background-color, border-color, border-width, opacity',
            'transition-duration': 200,
            'transition-timing-function': 'ease-in-out'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': 'rgba(150, 150, 150, 0.7)',
            'curve-style': 'bezier',
            'opacity': 0.8,
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'rgba(150, 150, 150, 0.7)',
            'arrow-scale': 0.7,
            'z-index': 1,
            'transition-property': 'line-color, width, opacity, target-arrow-color',
            'transition-duration': 200
          }
        },
        {
          selector: 'node:hover',
          style: {
            'width': (ele: NodeSingular) => {
              const capital = ele.data('importance') || 0.5;
              // 悬停时放大到1.1倍
              return (60 + (capital * 90)) * 1.1;
            },
            'height': (ele: NodeSingular) => {
              const capital = ele.data('importance') || 0.5;
              return (60 + (capital * 90)) * 1.1;
            },
            'background-opacity': 0.95,
            'border-width': 5,
            'border-color': '#fff',
            'border-opacity': 1,
            'text-background-opacity': 0,
            'color': '#FFFFFF',
            'text-outline-width': 2.5,
            'text-outline-color': '#000000',
            'text-outline-opacity': 1,
            'font-size': '22px',
            'font-weight': 'bold',
            'z-index': 999
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-opacity': 1,
            'border-width': 5,
            'border-color': '#f8f32b',
            'border-opacity': 1,
            'text-background-opacity': 0,
            'color': '#FFFFFF',
            'text-outline-width': 3,
            'text-outline-color': '#000000',
            'text-outline-opacity': 1,
            'font-size': '24px',
            'font-weight': 'bold',
            'z-index': 999,
            'width': (ele: NodeSingular) => {
              const capital = ele.data('importance') || 0.5;
              return (60 + (capital * 90)) * 1.2;
            },
            'height': (ele: NodeSingular) => {
              const capital = ele.data('importance') || 0.5;
              return (60 + (capital * 90)) * 1.2;
            }
          }
        }
      ],
      layout: {
        name: 'preset', // 使用预设布局
        fit: true,
        padding: 50
      },
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      panningEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
      selectionType: 'single',
      autoungrabify: false,
      autounselectify: false
    });

    cyRef.current = cy;

    // 添加点击事件处理
    cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const nodeId = node.id();
      
      // 阻止事件冒泡，防止触发画布的fit操作
      evt.originalEvent?.preventDefault();
      evt.originalEvent?.stopPropagation();

      // 处理所有节点的展开/收起
      console.log(`节点点击处理: ${nodeId}`);
      toggleNodeExpansion(nodeId);
      
      // 高亮点击的节点及其相关边
      cy.elements().removeClass('highlighted');
      
      // 高亮节点
      node.addClass('highlighted');
      
      // 高亮连接的边
      node.connectedEdges().addClass('highlighted');
      
      // 高亮相邻节点
      node.neighborhood('node').addClass('highlighted');
      
      // 放大点击的节点
      node.animate({
        style: {
          'width': node.width() * 1.2,
          'height': node.height() * 1.2
        },
        duration: 300,
        easing: 'ease-out-cubic'
      });
    });

    // 添加拖拽相关事件处理
    let nodeBeingDragged: cytoscape.NodeSingular | null = null;
    let descendants: cytoscape.NodeCollection | null = null;
    let lastPosition: { x: number, y: number } | null = null;
    
    // 监听节点的grabify事件（拖拽开始）
    cy.on('grab', 'node', function(e) {
      const node = e.target;
      const nodeId = node.id();
      
      // 保存当前节点
      nodeBeingDragged = node;
      
      // 查找所有子孙节点
      descendants = cy.collection();
      
      cy.nodes().forEach(n => {
        if (n.id() !== nodeId && n.id().startsWith(nodeId)) {
          // 因为之前已经初始化为cy.collection()，所以descendants此处一定不为null
          descendants!.union(n);
        }
      });
      
      // 另一种方式：直接使用filter查找所有子孙节点
      descendants = cy.nodes().filter(n => n.id() !== nodeId && n.id().startsWith(nodeId));
      
      // 记录初始位置
      lastPosition = { ...node.position() };
      
      // 启用节点拖拽
      node.unlock();
      // 确保descendants不为null
      if (descendants) {
        descendants.unlock();
      }
      
      console.log(`开始拖拽节点: ${nodeId}, 子节点数量: ${descendants ? descendants.size() : 0}`);
    });
    
    // 监听拖拽过程
    cy.on('drag', 'node', function(e) {
      const node = e.target;
      
      // 确保是正在拖拽的节点
      if (!nodeBeingDragged || node.id() !== nodeBeingDragged.id() || !lastPosition || !descendants) {
        return;
      }
      
      // 计算位移
      const currentPosition = node.position();
      const dx = currentPosition.x - lastPosition.x;
      const dy = currentPosition.y - lastPosition.y;
      
      // 移动所有子孙节点
      descendants.forEach(descendant => {
        const pos = descendant.position();
        descendant.position({
          x: pos.x + dx,
          y: pos.y + dy
        });
      });
      
      // 更新上一个位置
      lastPosition = { ...currentPosition };
    });
    
    // 监听拖拽结束
    cy.on('free', 'node', function(e) {
      const node = e.target;
      
      // 确保是正在拖拽的节点
      if (nodeBeingDragged && node.id() === nodeBeingDragged.id()) {
        console.log(`结束拖拽节点: ${node.id()}`);
        
        // 清理状态
        nodeBeingDragged = null;
        lastPosition = null;
        descendants = null;
      }
    });

    // 添加样式
    cy.style()
      .selector('.highlighted')
      .style({
        'background-color': '#000000',
        'border-color': '#FFD700',
        'border-width': 5,
        'border-opacity': 1,
        'opacity': 1,
        'text-background-opacity': 0,
        'color': '#FFFFFF',
        'text-outline-width': 3,
        'text-outline-color': '#000000',
        'text-outline-opacity': 1,
        'font-size': '24px',
        'font-weight': 'bold',
        'z-index': 999,
        'width': (ele: NodeSingular) => {
          const capital = ele.data('importance') || 0.5;
          return (60 + (capital * 90)) * 1.2;
        },
        'height': (ele: NodeSingular) => {
          const capital = ele.data('importance') || 0.5;
          return (60 + (capital * 90)) * 1.2;
        }
      })
      .selector('edge.highlighted')
      .style({
        'line-color': '#FF4500',
        'width': 7,
        'opacity': 1,
        'z-index': 999,
        'target-arrow-color': '#FF4500',
        'arrow-scale': 2.5,
        'line-style': 'solid'
      })
      // 添加淡入淡出过渡
      .selector('node')
      .style({
        'transition-property': 'opacity, width, height, background-color, border-color, border-width',
        'transition-duration': 300,
        'transition-timing-function': 'ease-in-out'
      })
      .selector('edge')
      .style({
        'transition-property': 'opacity, width, line-color',
        'transition-duration': 300,
        'transition-timing-function': 'ease-in-out'
      })
      .update();
    
    // 手动设置预设布局
    cy.ready(() => {
      // 构建节点之间的父子关系
      const childrenMap: {[key: string]: cytoscape.NodeSingular[]} = {};
      const parentMap: {[key: string]: cytoscape.NodeSingular} = {};
      
      // 获取所有边，建立父子关系
      cy.edges().forEach(edge => {
        const source = edge.source();
        const target = edge.target();
        
        const sourceId = source.id();
        const targetId = target.id();
        
        if (sourceId.length < targetId.length) {
          if (!childrenMap[sourceId]) {
            childrenMap[sourceId] = [];
          }
          childrenMap[sourceId].push(target);
          parentMap[targetId] = source;
        }
      });
      
      // 使用BFS方式构建扇形布局
      const layoutByLevel = () => {
        // 获取顶层节点（DS和AB）
        const dsNode = cy.getElementById('DS');
        const abNode = cy.getElementById('AB');
        
        // 计算每个节点的总子节点数（包括间接子节点）
        const calculateTotalChildren = (node: cytoscape.NodeSingular): number => {
          const children = (childrenMap[node.id()] || []) as cytoscape.NodeSingular[];
          let total = children.length;
          children.forEach(child => {
            total += calculateTotalChildren(child);
          });
          return total;
        };
      
        // 计算节点位置的函数
        const positionNode = (
          node: cytoscape.NodeSingular,
          level: number,
          startAngle: number,
          endAngle: number,
          centerX: number,
          centerY: number
        ) => {
          // 获取并排序子节点
          const children = (childrenMap[node.id()] || [])
            .sort((a, b) => a.id().localeCompare(b.id()));
      
          // 计算基础半径和节点大小
          const baseRadius = 400 * (level + 1);
          
          // 计算当前节点的位置
          const angle = (startAngle + endAngle) / 2;
          const radius = baseRadius;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          
          // 设置节点位置
          node.position({ x, y });
          
          if (children.length > 0) {
            // 计算每个子节点的权重（基于其子树大小）
            const childrenWeights = children.map(child => {
              const totalChildren = calculateTotalChildren(child);
              return Math.max(1, totalChildren); // 确保每个节点至少有1的权重
            });
      
            // 计算总权重
            const totalWeight = childrenWeights.reduce((sum, weight) => sum + weight, 0);
      
            // 根据权重分配角度
            let currentAngle = startAngle;
            children.forEach((child, index) => {
              const weight = childrenWeights[index];
              const angleRange = (endAngle - startAngle) * (weight / totalWeight);
              const childEndAngle = currentAngle + angleRange;
              
              positionNode(child, level + 1, currentAngle, childEndAngle, centerX, centerY);
              currentAngle = childEndAngle;
            });
          }
        };
        
        // 设置知识图谱和能力图谱的中心点
        const centerDistance = 1200; // 两个图谱中心的距离
        const knowledgeCenterX = -centerDistance / 2;
        const knowledgeCenterY = 0;
        const abilityCenterX = centerDistance / 2;
        const abilityCenterY = 0;
        
        // 设置DS和AB节点的位置
        if (dsNode) {
          dsNode.position({ x: knowledgeCenterX, y: knowledgeCenterY });
        }
        if (abNode) {
          abNode.position({ x: abilityCenterX, y: abilityCenterY });
        }
        
        // 布局DS节点的子树
        if (dsNode && childrenMap['DS']) {
          const dsChildren = childrenMap['DS'].sort((a, b) => a.id().localeCompare(b.id()));
          const dsChildrenWeights = dsChildren.map(child => {
            const totalChildren = calculateTotalChildren(child);
            return Math.max(1, totalChildren);
          });
          const totalDsWeight = dsChildrenWeights.reduce((sum, weight) => sum + weight, 0);
          
          let currentAngle = 0;
          dsChildren.forEach((child, index) => {
            const weight = dsChildrenWeights[index];
            const angleRange = 2 * Math.PI * (weight / totalDsWeight);
            const endAngle = currentAngle + angleRange;
            
            positionNode(child, 0, currentAngle, endAngle, knowledgeCenterX, knowledgeCenterY);
            currentAngle = endAngle;
          });
        }
        
        // 布局AB节点的子树
        if (abNode && childrenMap['AB']) {
          const abChildren = childrenMap['AB'].sort((a, b) => a.id().localeCompare(b.id()));
          const abChildrenWeights = abChildren.map(child => {
            const totalChildren = calculateTotalChildren(child);
            return Math.max(1, totalChildren);
          });
          const totalAbWeight = abChildrenWeights.reduce((sum, weight) => sum + weight, 0);
          
          let currentAngle = 0;
          abChildren.forEach((child, index) => {
            const weight = abChildrenWeights[index];
            const angleRange = 2 * Math.PI * (weight / totalAbWeight);
            const endAngle = currentAngle + angleRange;
            
            positionNode(child, 0, currentAngle, endAngle, abilityCenterX, abilityCenterY);
            currentAngle = endAngle;
          });
        }
      };
      
      // 先应用布局算法确保节点有初始位置
      const layout = cy.layout({
        name: 'cose-bilkent',
        // 使用类型断言以避免TS错误
        animate: false,
        animationDuration: 0,
        nodeRepulsion: 4500,
        idealEdgeLength: 100,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        gravityRange: 3.8,
        nodeDimensionsIncludeLabels: true
      } as any);
      
      layout.run();

      // 然后应用扇形布局
      setTimeout(() => {
        // 执行扇形布局
        layoutByLevel();
        
        // 调整视图
        cy.fit(undefined, 80);
        cy.center();
  
        // 初始时根据展开状态更新节点可见性
        updateNodesVisibility();
        
        // 初始化节点的展开/收起标记
        updateExpandCollapseMarkers();
        
        // 初始化提示框
        setupTooltips();
      }, 100);
    });

    // 添加缩放重置功能
    cy.on('dblclick', function(event) {
      if (event.target === cy || event.target.isEdge()) {
        cy.animation({
          fit: {
            eles: cy.elements(),
            padding: 50
          },
          duration: 500,
          easing: 'ease-out-cubic'
        }).play();
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (cyRef.current) {
        cyRef.current.resize();
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      resizeObserver.disconnect();
      
      // 移除提示框
      const tooltip = document.querySelector('.node-tooltip');
      if (tooltip && tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    };
  }, [knowledgeNodes, abilityNodes, loading, error]);

  // 单独监听expandedNodes变化，只更新节点可见性而不重新渲染整个图
  useEffect(() => {
    if (cyRef.current) {
      updateNodesVisibility();
      // 更新节点的展开/收起标记
      updateExpandCollapseMarkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedNodes]);

  // 添加更新节点展开/收起标记的函数
  const updateExpandCollapseMarkers = () => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    cy.nodes().forEach(node => {
      const nodeId = node.id();
      
      // 检查是否有子节点
      let hasChildren = false;
      if (nodeId === 'DS') {
        // 对于DS根节点，子节点是直接以DS开头的节点
        const childNodes = cy.nodes().filter(n => {
          if (n.isNode()) {
            const id = n.id();
            return id.startsWith('DS') && id !== 'DS' && id.length <= 4;
          }
          return false;
        });
        hasChildren = childNodes.length > 0;
      } else if (nodeId === 'AB') {
        // 对于AB根节点，子节点是直接以AB开头的节点
        const childNodes = cy.nodes().filter(n => {
          if (n.isNode()) {
            const id = n.id();
            return id.startsWith('AB') && id !== 'AB' && id.length <= 4;
          }
          return false;
        });
        hasChildren = childNodes.length > 0;
      } else {
        // 对于其他节点，查找前缀匹配的子节点
        const childNodes = cy.nodes().filter(n => {
          if (n.isNode()) {
            const id = n.id();
            return id.startsWith(nodeId) && id.length === nodeId.length + 2;
          }
          return false;
        });
        hasChildren = childNodes.length > 0;
      }
      
      if (hasChildren) {
        // 如果有子节点，根据当前展开状态添加+/-标记
        const isExpanded = expandedNodes.has(nodeId);
        const originalLabel = node.data('originalLabel') || node.data('label');
        
        // 保存原始标签，以便后续修改
        if (!node.data('originalLabel')) {
          node.data('originalLabel', originalLabel);
        }
        
        // 设置带有展开/收起标记的新标签
        const newLabel = originalLabel + (isExpanded ? ' −' : ' +');
        node.data('label', newLabel);
      }
    });
  };

  // 节点展开和收起逻辑
  const toggleNodeExpansion = (nodeId: string) => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    const node = cy.getElementById(nodeId);
    
    // 检查是否有子节点
    let children;
    if (nodeId === 'DS') {
      // 对于DS根节点，子节点是直接以DS开头的节点
      children = cy.nodes().filter(n => {
        if (n.isNode()) {
          const id = n.id();
          return id.startsWith('DS') && id !== 'DS' && id.length <= 4;
        }
        return false;
      });
    } else if (nodeId === 'AB') {
      // 对于AB根节点，子节点是直接以AB开头的节点
      children = cy.nodes().filter(n => {
        if (n.isNode()) {
          const id = n.id();
          return id.startsWith('AB') && id !== 'AB' && id.length <= 4;
        }
        return false;
      });
    } else {
      // 对于其他节点，查找前缀匹配的子节点
      children = cy.nodes().filter(n => {
        if (n.isNode()) {
          const id = n.id();
          return id.startsWith(nodeId) && id.length === nodeId.length + 2;
        }
        return false;
      });
    }
    
    if (children.length === 0) {
      return; // 没有子节点，不需要展开/收起
    }
    
    // 更新expandedNodes状态
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      const isCurrentlyExpanded = newSet.has(nodeId);
      
      if (isCurrentlyExpanded) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      
      return newSet;
    });
  };

  // 更新节点可见性，优化性能并添加平滑过渡效果
  const updateNodesVisibility = () => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // 首先将所有节点设置为透明而不是隐藏，以便于动画过渡
    cy.batch(() => {
      // 处理DS的直接子节点
      cy.nodes().filter(node => {
        const nodeId = node.id();
        return nodeId !== 'DS' && nodeId.startsWith('DS') && nodeId.length <= 4;
      }).forEach(node => {
        const isDSExpanded = expandedNodes.has('DS');
        node.style('opacity', isDSExpanded ? 1 : 0);
        
        // 使用setTimeout确保CSS过渡动画完成后再更改display属性
        setTimeout(() => {
          if (cyRef.current) {
            node.style('display', isDSExpanded ? 'element' : 'none');
          }
        }, 300);
      });
      
      // 处理AB的直接子节点
      cy.nodes().filter(node => {
        const nodeId = node.id();
        return nodeId !== 'AB' && nodeId.startsWith('AB') && nodeId.length <= 4;
      }).forEach(node => {
        const isABExpanded = expandedNodes.has('AB');
        node.style('opacity', isABExpanded ? 1 : 0);
        
        // 使用setTimeout确保CSS过渡动画完成后再更改display属性
        setTimeout(() => {
          if (cyRef.current) {
            node.style('display', isABExpanded ? 'element' : 'none');
          }
        }, 300);
      });
      
      // 处理其他非根节点
      cy.nodes().filter(node => {
        const nodeId = node.id();
        return nodeId !== 'DS' && nodeId !== 'AB' && 
               !(nodeId.startsWith('DS') && nodeId.length <= 4) && 
               !(nodeId.startsWith('AB') && nodeId.length <= 4);
      }).forEach(node => {
        const nodeId = node.id();
        let parentId = '';
        
        // 计算父节点ID
        if (nodeId.startsWith('DS') || nodeId.startsWith('AB')) {
          parentId = nodeId.slice(0, -2);
          if (parentId === '') {
            parentId = nodeId.startsWith('DS') ? 'DS' : 'AB';
          }
        }
        
        const isParentExpanded = expandedNodes.has(parentId);
        
        // 递归检查上层节点是否都展开
        let shouldBeVisible = isParentExpanded;
        let currentParentId = parentId;
        
        while ((currentParentId !== 'DS' && currentParentId !== 'AB') && 
               currentParentId.length > 4 && shouldBeVisible) {
          const grandParentId = currentParentId.slice(0, -2);
          shouldBeVisible = expandedNodes.has(grandParentId);
          currentParentId = grandParentId;
        }
        
        // 还需检查根节点是否展开（对于深层级节点）
        if (shouldBeVisible) {
          if (nodeId.startsWith('DS') && !expandedNodes.has('DS')) {
            shouldBeVisible = false;
          } else if (nodeId.startsWith('AB') && !expandedNodes.has('AB')) {
            shouldBeVisible = false;
          }
        }
        
        node.style('opacity', shouldBeVisible ? 1 : 0);
        
        // 使用setTimeout确保CSS过渡动画完成后再更改display属性
        setTimeout(() => {
          if (cyRef.current) {
            node.style('display', shouldBeVisible ? 'element' : 'none');
          }
        }, 300);
      });
      
      // 确保DS和AB根节点总是可见
      cy.getElementById('DS').style('display', 'element').style('opacity', 1);
      cy.getElementById('AB').style('display', 'element').style('opacity', 1);
      
      // 边只有在源节点和目标节点都可见时才显示
      cy.edges().forEach(edge => {
        const source = edge.source();
        const target = edge.target();
        
        // 获取源节点和目标节点的不透明度并转换为数字
        const sourceOpacity = parseFloat(source.style('opacity'));
        const targetOpacity = parseFloat(target.style('opacity'));
        
        const isSourceVisible = !isNaN(sourceOpacity) && sourceOpacity > 0;
        const isTargetVisible = !isNaN(targetOpacity) && targetOpacity > 0;
        
        edge.style('opacity', (isSourceVisible && isTargetVisible) ? 0.8 : 0);
        
        // 使用setTimeout确保CSS过渡动画完成后再更改display属性
        setTimeout(() => {
          if (cyRef.current) {
            edge.style('display', (isSourceVisible && isTargetVisible) ? 'element' : 'none');
          }
        }, 300);
      });
    });
  };

  // 添加设置提示框函数
  const setupTooltips = () => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // 创建提示框元素
    let tooltip = document.querySelector('.node-tooltip') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'node-tooltip';
      tooltip.style.display = 'none';
      document.body.appendChild(tooltip);
    }
    
    // 清理字段值，移除可能的重复前缀
    const cleanFieldValue = (value: string | number | undefined, prefix: string): string => {
      if (value === undefined) return '未设置';
      
      // 转换为字符串
      let strValue = String(value);
      
      // 从截图看，编号的值可能是"编号: DS07"这种格式
      // 检查是否包含冒号，如果有则只保留冒号后面的内容
      if (strValue.includes(':')) {
        strValue = strValue.split(':').slice(1).join(':').trim();
      }
      
      return strValue;
    };
    
    // 鼠标悬停在节点上显示提示框
    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();
      const nodeType = nodeData.nodeType;
      
      // 根据节点类型设置不同的提示框内容
      if (nodeType === 'knowledge') {
        // 知识节点提示框
        tooltip.innerHTML = `
          <div class="tooltip-header" style="--dot-color: ${node.style('background-color')}">
            ${nodeData.label || nodeData.id}
          </div>
          <div class="tooltip-content">
            <div class="tooltip-item">
              <span class="value">${cleanFieldValue(nodeData.id, '编号:')}</span>
            </div>
            <div class="tooltip-item">
              <span class="label">类型:</span>
              <span class="value">${cleanFieldValue(nodeData.type, '类型:')}</span>
            </div>
            <div class="tooltip-item">
              <span class="label">重要性:</span>
              <span class="value">${cleanFieldValue(nodeData.importance, '重要性:')}</span>
            </div>
            <div class="tooltip-item">
              <span class="label">难度:</span>
              <span class="value">${cleanFieldValue(nodeData.difficulty, '难度:')}</span>
            </div>
            ${nodeData.description ? `
              <div class="tooltip-description">
                <div class="label">描述:</div>
                <div class="value">${cleanFieldValue(nodeData.description, '描述:')}</div>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        // 能力节点提示框
        tooltip.innerHTML = `
          <div class="tooltip-header" style="--dot-color: ${node.style('background-color')}">
            ${nodeData.label || nodeData.id}
          </div>
          <div class="tooltip-content">
            <div class="tooltip-item">
              <span class="value">${cleanFieldValue(nodeData.id, '编号:')}</span>
            </div>
            ${nodeData.name ? `
              <div class="tooltip-item">
                <span class="label">能力:</span>
                <span class="value">${cleanFieldValue(nodeData.name, '能力:')}</span>
              </div>
            ` : ''}
            <div class="tooltip-item">
              <span class="label">类型:</span>
              <span class="value">${cleanFieldValue(nodeData.type, '类型:')}</span>
            </div>
            <div class="tooltip-item">
              <span class="label">重要性:</span>
              <span class="value">${cleanFieldValue(nodeData.importance, '重要性:')}</span>
            </div>
            <div class="tooltip-item">
              <span class="label">难度:</span>
              <span class="value">${cleanFieldValue(nodeData.difficulty, '难度:')}</span>
            </div>
            ${nodeData.tag ? `
              <div class="tooltip-item">
                <span class="label">标签:</span>
                <span class="value">${cleanFieldValue(nodeData.tag, '标签:')}</span>
              </div>
            ` : ''}
            ${nodeData.description ? `
              <div class="tooltip-description">
                <div class="label">描述:</div>
                <div class="value">${cleanFieldValue(nodeData.description, '描述:')}</div>
              </div>
            ` : ''}
          </div>
        `;
      }
      
      // 显示提示框
      tooltip.style.display = 'block';
      
      // 更新提示框位置
      const position = event.renderedPosition || node.renderedPosition();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (containerRect) {
        // 计算提示框位置，确保在视口内且靠近鼠标
        const x = containerRect.left + position.x + 20;
        const y = containerRect.top + position.y - 30;
        
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        
        // 检查并调整提示框位置，确保不超出屏幕
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (tooltipRect.right > viewportWidth) {
          tooltip.style.left = `${x - tooltipRect.width - 40}px`;
        }
        
        if (tooltipRect.bottom > viewportHeight) {
          tooltip.style.top = `${y - tooltipRect.height}px`;
        }
      }
    });
    
    // 鼠标离开节点隐藏提示框
    cy.on('mouseout', 'node', () => {
      tooltip.style.display = 'none';
    });
    
    // 移动时更新提示框位置
    cy.on('mousemove', 'node', (event) => {
      if (tooltip.style.display === 'none') return;
      
      const position = event.renderedPosition;
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (containerRect && position) {
        // 更新提示框位置
        const x = containerRect.left + position.x + 20;
        const y = containerRect.top + position.y - 30;
        
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        
        // 检查并调整提示框位置，确保不超出屏幕
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (tooltipRect.right > viewportWidth) {
          tooltip.style.left = `${x - tooltipRect.width - 40}px`;
        }
        
        if (tooltipRect.bottom > viewportHeight) {
          tooltip.style.top = `${y - tooltipRect.height}px`;
        }
      }
    });
  };

  // 获取可选的父节点列表
  const getAvailableParents = () => {
    if (nodeType === 'knowledge') {
      // 首先添加根节点
      const parents: {id: string, label: string, level: number}[] = [
        { id: 'DS', label: 'DS - 数据结构知识', level: 0 }
      ];
      
      // 添加所有可以作为父节点的节点（章节、小节等）
      knowledgeNodes.forEach(node => {
        // 最多添加到子节点的父节点级别
        if (node.id !== 'DS' && node.id.length <= 8) { // 限制父节点级别
          const level = (node.id.length - 2) / 2; // 计算节点层级，用于缩进显示
          parents.push({ 
            id: node.id, 
            label: `${node.id} - ${node.label}`, 
            level
          });
        }
      });
      
      return parents;
    } else {
      // 对于能力节点的处理
      const parents: {id: string, label: string, level: number}[] = [
        { id: 'AB', label: 'AB - 算法能力', level: 0 }
      ];
      
      abilityNodes.forEach(node => {
        if (node.id !== 'AB' && node.id.length <= 8) {
          const level = (node.id.length - 2) / 2;
          parents.push({ 
            id: node.id, 
            label: `${node.id} - ${node.label}`, 
            level
          });
        }
      });
      
      return parents;
    }
  };
  
  // 根据所选父节点生成下一个可用的ID
  const generateNextAvailableId = (parentId: string) => {
    if (!parentId) return '';
    
    const prefix = parentId === 'DS' || parentId === 'AB' ? parentId : parentId;
    const nodes = nodeType === 'knowledge' ? knowledgeNodes : abilityNodes;
    
    // 找出同一父节点下已存在的子节点
    const childNodes = nodes.filter(node => 
      node.id !== prefix && 
      node.id.startsWith(prefix) && 
      node.id.length === prefix.length + 2
    );
    
    if (childNodes.length === 0) {
      // 如果没有子节点，则生成第一个子节点ID
      return `${prefix}01`;
    }
    
    // 找出最大的序号并加1
    let maxNum = 0;
    childNodes.forEach(node => {
      const numStr = node.id.slice(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    
    // 生成下一个序号的字符串形式
    const nextNum = maxNum + 1;
    const nextNumStr = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    
    return `${prefix}${nextNumStr}`;
  };
  
  // 处理父节点选择变化
  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    setSelectedParentId(parentId);
    
    if (parentId) {
      const nextId = generateNextAvailableId(parentId);
      setNextAvailableId(nextId);
      
      if (!customIdInput) {
        // 如果不是自定义输入模式，则自动更新ID
        setNewNode(prev => ({...prev, id: nextId}));
      }
    } else {
      setNextAvailableId('');
      if (!customIdInput) {
        setNewNode(prev => ({...prev, id: ''}));
      }
    }
  };
  
  // 处理自定义ID切换
  const handleCustomIdToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isCustom = e.target.checked;
    setCustomIdInput(isCustom);
    
    if (!isCustom && selectedParentId) {
      // 如果切换回自动生成模式，则使用推荐的ID
      setNewNode(prev => ({...prev, id: nextAvailableId}));
    }
  };
  
  // 重置添加节点表单
  const resetAddNodeForm = () => {
    setNewNode({
      id: '',
      label: '',
      difficulty: 0.5,
      importance: 0.5,
      description: '',
      tag: ''
    });
    setSelectedParentId('');
    setNextAvailableId('');
    setCustomIdInput(false);
    setShowAddModal(false);
  };
  
  // 修改打开添加模态框的处理
  const openAddNodeModal = () => {
    // 重置表单
    resetAddNodeForm();
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div>错误: {error}</div>
      </div>
    );
  }

  return (
    <>
      <style>{GlobalStyles}</style>
      
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      
      {/* 控制面板放在最外层，确保它始终可见 */}
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button 
          onClick={openAddNodeModal}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#22c55e',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span style={{ marginTop: '4px' }}>添加</span>
          <span style={{ marginTop: '1px' }}>节点</span>
        </button>
        
        <button 
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#ef4444',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span style={{ marginTop: '4px' }}>删除</span>
          <span style={{ marginTop: '1px' }}>节点</span>
        </button>
        
        <button 
          onClick={() => showToast('测试消息显示', 'success')}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#3b82f6',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span style={{ marginTop: '4px' }}>测试</span>
          <span style={{ marginTop: '1px' }}>提示</span>
        </button>
      </div>
      
      <div ref={containerRef} style={styles.container}>
        {/* 图表渲染区域 */}
      </div>
      
      {/* Toast消息 */}
      <div className="toast-container" style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '350px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            style={{
              padding: '16px',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '500',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              backgroundColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
              animation: 'slideInRight 0.3s ease-out forwards',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: '350px'
            }}
          >
            <div style={{ 
              marginRight: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              {toast.type === 'success' ? (
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
            <span style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{toast.message}</span>
          </div>
        ))}
      </div>
      
      {/* 添加节点模态框 */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            animation: 'fadeIn 0.3s ease-out',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
              <div style={{ 
                backgroundColor: '#22c55e', 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginRight: '15px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#111827' }}>添加新节点</h2>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                节点类型
              </label>
              <div style={{ 
                display: 'flex', 
                width: '100%', 
                borderRadius: '8px', 
                overflow: 'hidden',
                border: '2px solid #e5e7eb'
              }}>
                <button 
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    border: 'none', 
                    background: nodeType === 'knowledge' ? '#22c55e' : '#f9fafb', 
                    color: nodeType === 'knowledge' ? 'white' : '#4b5563',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setNodeType('knowledge');
                    // 切换类型时重置父节点和ID
                    setSelectedParentId('');
                    setNextAvailableId('');
                    setNewNode(prev => ({...prev, id: ''}));
                  }}
                >
                  知识节点
                </button>
                <button 
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    border: 'none', 
                    background: nodeType === 'ability' ? '#22c55e' : '#f9fafb', 
                    color: nodeType === 'ability' ? 'white' : '#4b5563',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setNodeType('ability');
                    // 切换类型时重置父节点和ID
                    setSelectedParentId('');
                    setNextAvailableId('');
                    setNewNode(prev => ({...prev, id: ''}));
                  }}
                >
                  能力节点
                </button>
              </div>
            </div>
            
            {/* 父节点选择 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                父节点 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  backgroundColor: 'white',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px center',
                  backgroundSize: '12px'
                }}
                value={selectedParentId}
                onChange={handleParentChange}
                onFocus={(e) => {
                  e.target.style.borderColor = '#22c55e';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              >
                <option value="">请选择父节点</option>
                {getAvailableParents().map(parent => (
                  <option 
                    key={parent.id} 
                    value={parent.id}
                    style={{ 
                      paddingLeft: `${parent.level * 20}px`,
                      fontWeight: parent.level === 0 ? 'bold' : 'normal'
                    }}
                  >
                    {'  '.repeat(parent.level)}{parent.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 节点ID分组 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  节点编号 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="customIdToggle"
                    checked={customIdInput}
                    onChange={handleCustomIdToggle}
                    style={{ marginRight: '6px' }}
                  />
                  <label 
                    htmlFor="customIdToggle" 
                    style={{ fontSize: '0.85rem', color: '#4b5563', cursor: 'pointer' }}
                  >
                    自定义编号
                  </label>
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%',
              }}>
                <input 
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                    backgroundColor: customIdInput ? 'white' : '#f3f4f6'
                  }}
                  type="text" 
                  placeholder={nodeType === 'knowledge' ? "例如: DS01" : "例如: AB01"}
                  value={newNode.id || ''}
                  onChange={(e) => setNewNode({...newNode, id: e.target.value})}
                  readOnly={!customIdInput}
                  onFocus={(e) => {
                    if (customIdInput) {
                      e.target.style.borderColor = '#22c55e';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
                
                {nextAvailableId && !customIdInput && (
                  <div style={{ 
                    marginLeft: '10px',
                    color: '#22c55e',
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                  }}>
                    推荐ID
                  </div>
                )}
              </div>
              
              {selectedParentId && !customIdInput && (
                <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#6b7280' }}>
                  系统已自动生成下一个可用的节点编号
                </div>
              )}
              
              {customIdInput && (
                <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#ef4444' }}>
                  注意：请确保自定义编号符合格式规范，并且是所选父节点的有效子节点
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                节点名称 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                type="text" 
                placeholder="节点名称"
                value={newNode.label || ''}
                onChange={(e) => setNewNode({...newNode, label: e.target.value})}
                onFocus={(e) => {
                  e.target.style.borderColor = '#22c55e';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  难度系数 (0-1)
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    type="number" 
                    min="0"
                    max="1"
                    step="0.1"
                    value={newNode.difficulty || 0.5}
                    onChange={(e) => setNewNode({...newNode, difficulty: parseFloat(e.target.value)})}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#22c55e';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                    }}
                  />
                </div>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  重要性 (0-1)
                </label>
                <input 
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  type="number" 
                  min="0"
                  max="1"
                  step="0.1"
                  value={newNode.importance || 0.5}
                  onChange={(e) => setNewNode({...newNode, importance: parseFloat(e.target.value)})}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#22c55e';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                描述
              </label>
              <textarea 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  minHeight: '100px',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
                placeholder="节点描述内容"
                value={newNode.description || ''}
                onChange={(e) => setNewNode({...newNode, description: e.target.value})}
                onFocus={(e) => {
                  e.target.style.borderColor = '#22c55e';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
            </div>
            
            {nodeType === 'ability' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  标签
                </label>
                <input 
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  type="text" 
                  placeholder="节点标签"
                  value={newNode.tag || ''}
                  onChange={(e) => setNewNode({...newNode, tag: e.target.value})}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#22c55e';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
              <button 
                style={{ 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: '#f3f4f6', 
                  color: '#4b5563', 
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={resetAddNodeForm}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
              >
                取消
              </button>
              <button 
                style={{ 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: '#22c55e', 
                  color: 'white', 
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={addNode}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#16a34a';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#22c55e';
                }}
              >
                添加节点
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 删除节点模态框 */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '16px',
            width: '450px',
            maxWidth: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
              <div style={{ 
                backgroundColor: '#ef4444', 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginRight: '15px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#111827' }}>删除节点</h2>
            </div>
            
            <p style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              color: '#4b5563', 
              lineHeight: 1.5 
            }}>
              请输入要删除的节点编号。请注意，删除后节点数据将被移除，但子节点将保留并在节点重新添加时显示。
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                节点编号 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                type="text" 
                placeholder="输入要删除的节点编号"
                value={nodeToDelete}
                onChange={(e) => setNodeToDelete(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ef4444';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
              <button 
                style={{ 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: '#f3f4f6', 
                  color: '#4b5563', 
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  setNodeToDelete('');
                  setShowDeleteModal(false);
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
              >
                取消
              </button>
              <button 
                style={{ 
                  padding: '12px 24px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={deleteNode}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                删除节点
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Graph;
