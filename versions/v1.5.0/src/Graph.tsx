// 添加全局类型声明
declare global {
  interface Window {
    layoutGraph: () => void;
  }
}

import React, { useRef, useEffect, useState } from 'react';
import cytoscape, { NodeSingular, NodeDataDefinition, LayoutOptions } from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent'; // 更智能的布局算法
import { KnowledgeNode, AbilityNode, readExcelFile, readAbilityExcelFile, readKnowledgeAbilityMappingExcel } from './utils/excelReader';
import { processAndSaveMapping } from './utils/api';
import { useToast } from './components/Toast';

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

// 创建知识点与能力点之间的连线
const createKnowledgeAbilityEdges = (knowledgeNodes: KnowledgeNode[], abilityNodes: AbilityNode[], 
  connections: { knowledge: string, ability: string }[] = [
    { knowledge: 'DS0101', ability: 'AB010201' },
    { knowledge: 'DS0102', ability: 'AB020102' },
    { knowledge: 'DS0103', ability: 'AB010101' },
    { knowledge: 'DS0104', ability: 'AB020103' },
    { knowledge: 'DS010201', ability: 'AB010102' },
    { knowledge: 'DS010202', ability: 'AB020301' },
    { knowledge: 'DS010203', ability: 'AB010202' },
    { knowledge: 'DS010204', ability: 'AB010204' },
    { knowledge: 'DS010205', ability: 'AB020301' },
    { knowledge: 'DS010206', ability: 'AB010102' },
    { knowledge: 'DS010207', ability: 'AB026' },
    { knowledge: 'DS010301', ability: 'AB048' },
    { knowledge: 'DS010401', ability: 'AB038' },
    { knowledge: 'DS010402', ability: 'AB020304' }
  ]) => {
  const edges: { data: { source: string, target: string, id: string, edgeType: string } }[] = [];
  
  // 创建节点ID的查找集合，用于快速检查节点是否存在
  const knowledgeNodeIds = new Set(knowledgeNodes.map(node => node.id));
  const abilityNodeIds = new Set(abilityNodes.map(node => node.id));
  
  connections.forEach(conn => {
    // 验证知识点和能力点是否存在
    if (knowledgeNodeIds.has(conn.knowledge) && abilityNodeIds.has(conn.ability)) {
      edges.push({ 
        data: { 
          source: conn.knowledge, 
          target: conn.ability,
          id: `${conn.knowledge}-${conn.ability}`,
          edgeType: 'knowledge-ability' // 标记为知识点和能力点之间的连线
        } 
      });
    } else {
      console.warn(`无法创建连线: 知识点 ${conn.knowledge} 或能力点 ${conn.ability} 不存在`);
    }
  });
  
  console.log(`创建了 ${edges.length} 条知识点-能力点连线`); // 调试日志
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
    z-index: 10000;
  }
  
  .toast {
    background: white;
    color: #333;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    max-width: 300px;
    animation: toast-fade-in 0.3s ease-out;
  }
  
  @keyframes toast-fade-in {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .toast.success {
    border-left: 4px solid #10b981;
  }
  
  .toast.error {
    border-left: 4px solid #ef4444;
  }
  
  .toast-icon {
    margin-right: 12px;
    flex-shrink: 0;
  }
  
  .toast-message {
    flex-grow: 1;
    font-size: 14px;
  }

  /* 搜索框样式 */
  .search-container {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    width: 250px;
  }

  .search-input-container {
    position: relative;
    width: 100%;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    padding-right: 32px; /* 为清除按钮留出空间 */
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
  }

  .search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }

  .search-clear:hover {
    color: #4b5563;
    background-color: #f3f4f6;
  }

  .search-results {
    margin-top: 10px;
    max-height: 200px;
    overflow-y: auto;
    border-radius: 6px;
    background: white;
  }

  .search-result-item {
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .search-result-item:hover {
    background: #f9fafb;
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .result-id {
    font-weight: bold;
    margin-right: 8px;
    color: #2563eb;
  }

  .result-label {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #374151;
  }

  .result-type {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #e5e7eb;
    color: #4b5563;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .search-status {
    margin-top: 8px;
    font-size: 13px;
    color: #6b7280;
    text-align: center;
  }

  .found-node {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(37, 99, 235, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
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
  
  /* 右键菜单样式 */
  @keyframes context-menu-fade-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  
  .context-menu-container {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    animation: context-menu-fade-in 0.2s ease-out forwards;
    min-width: 180px;
    z-index: 9999;
  }
  
  .context-menu-item {
    padding: 10px 16px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    color: #333;
  }
  
  .context-menu-item:hover {
    background-color: #f5f7fa;
  }
  
  .context-menu-item-icon {
    width: 18px;
    height: 18px;
    margin-right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .context-menu-divider {
    height: 1px;
    background-color: #eaedf0;
    margin: 6px 0;
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
  
  /* 删除预览样式 */
  .delete-preview {
    line-color: #ef4444 !important;
    target-arrow-color: #ef4444 !important;
    width: 3px !important;
    opacity: 0.8 !important;
    z-index: 999 !important;
  }
  
  .delete-preview-parent {
    background-color: #ef4444 !important;
    border-width: 4px !important;
    border-color: #b91c1c !important;
    opacity: 1 !important;
    z-index: 999 !important;
  }
  
  .delete-preview-child {
    border-width: 3px !important;
    border-style: dashed !important;
    border-color: #ef4444 !important;
    opacity: 0.7 !important;
  }
`;

const Graph = () => {
  // 使用Toast组件
  const { showToast } = useToast();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [abilityNodes, setAbilityNodes] = useState<AbilityNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string, label: string, nodeType?: 'knowledge' | 'ability' }>>([]);
  const [showingSearchResults, setShowingSearchResults] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['DS', 'AB'])); // 初始展开根节点
  const [nodeDeletionPreview, setNodeDeletionPreview] = useState<{
    nodeId: string,
    affectedNodes: string[]
  } | null>(null);
  const [editingNode, setEditingNode] = useState<{ id: string, label: string, description?: string, nodeType: 'knowledge' | 'ability' } | null>(null);
  const [addingChildNode, setAddingChildNode] = useState<{ parentId: string, nodeType: 'knowledge' | 'ability' } | null>(null);
  const [nodeForm, setNodeForm] = useState({
    label: '',
    description: '',
    customId: false,
    id: '',
    parentId: 'DS', // 默认父节点为DS
    type: 'knowledge' as 'knowledge' | 'ability'
  });
  const [knowledgeAbilityConnections, setKnowledgeAbilityConnections] = useState<Array<{ knowledge: string, ability: string }>>([]);
  const [statusMessage, setStatusMessage] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // 添加节点操作相关状态
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState<boolean>(false);
  const [showAddNodeSuccess, setShowAddNodeSuccess] = useState<boolean>(false);
  const [isCustomId, setIsCustomId] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false); // 添加这个状态
  
  // 添加缺失的状态变量
  const [nodeType, setNodeType] = useState<'knowledge' | 'ability'>('knowledge');
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [nextAvailableId, setNextAvailableId] = useState<string>('');
  const [customIdInput, setCustomIdInput] = useState<boolean>(false);
  const [newNode, setNewNode] = useState<{
    id?: string;
    label?: string;
    difficulty?: number;
    importance?: number;
    description?: string;
    tag?: string;
  }>({});
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editNodeId, setEditNodeId] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [nodeToDelete, setNodeToDelete] = useState<string>('');
  const [selectedNodeForDelete, setSelectedNodeForDelete] = useState<string | null>(null);
  const [previewDeleteNodes, setPreviewDeleteNodes] = useState<string[]>([]);
  const [isDeletePreviewActive, setIsDeletePreviewActive] = useState<boolean>(false);
  
  // 添加状态参数
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  // 添加数据加载函数
  useEffect(() => {
    const loadExcelData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 加载知识图谱数据
        try {
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
          
          // 加载知识点-能力点连接关系
          const mappingFileResponse = await fetch('/knowledge_ability_mapping.xlsx');
          if (mappingFileResponse.ok) {
            const mappingArrayBuffer = await mappingFileResponse.arrayBuffer();
            const mappingData = await readKnowledgeAbilityMappingExcel(mappingArrayBuffer);
            
            if (mappingData && mappingData.length > 0) {
              console.log('从Excel映射文件成功加载了连接关系数据');
              
              // 保存映射数据到JSON文件（实际上这在前端是模拟的操作）
              await processAndSaveMapping(mappingData);
              
              // 更新状态
              setKnowledgeAbilityConnections(mappingData);
            }
          }
          
          // 加载完成，设置loading为false
          setLoading(false);
      } catch (error) {
          console.error('加载Excel文件失败:', error);
        setError(error instanceof Error ? error.message : '未知错误');
          setLoading(false);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        setError(error instanceof Error ? error.message : '未知错误');
        setLoading(false);
      }
    };

    // 调用加载函数
    loadExcelData();
  }, []);

  // 初始化图谱 - 新增的代码
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
          nodeType: 'knowledge' as const,
          importance: node.importance || 0.5
        }
      })),
      ...abilityNodes.map(node => ({
        data: { 
          ...node,
          isRoot: node.id === 'AB' || node.id.length <= 4,
          type: getNodeType(node.id),
          nodeType: 'ability' as const,
          importance: node.importance || 0.5
        }
      }))
    ];
    
    // 创建边
    const edges = createEdges([...knowledgeNodes, ...abilityNodes]);

    // 创建知识点和能力点之间的连接
    const knowledgeAbilityEdges = createKnowledgeAbilityEdges(
      knowledgeNodes, 
      abilityNodes, 
      knowledgeAbilityConnections
    );
    
    // 初始化Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...combinedNodes, ...edges, ...knowledgeAbilityEdges],
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
              const nodeId = ele.id();
              // 根节点和一级节点使用较大尺寸
              if (nodeId === 'DS' || nodeId === 'AB' || (nodeId.length === 4 && (nodeId.startsWith('DS') || nodeId.startsWith('AB')))) {
                const baseSize = 100;
                const importance = ele.data('importance') || 0.5;
                return baseSize + (importance * 60);
              }
              // 子节点使用较小尺寸
              const baseSize = 60;
              const importance = ele.data('importance') || 0.5;
              return baseSize + (importance * 40);
            },
            'height': (ele: NodeSingular) => {
              const nodeId = ele.id();
              // 根节点和一级节点使用较大尺寸
              if (nodeId === 'DS' || nodeId === 'AB' || (nodeId.length === 4 && (nodeId.startsWith('DS') || nodeId.startsWith('AB')))) {
                const baseSize = 100;
                const importance = ele.data('importance') || 0.5;
                return baseSize + (importance * 60);
              }
              // 子节点使用较小尺寸
              const baseSize = 60;
              const importance = ele.data('importance') || 0.5;
              return baseSize + (importance * 40);
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
          selector: '.highlighted',
          style: {
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
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#FF4500',
            'width': 7,
            'opacity': 1,
            'z-index': 999,
            'target-arrow-color': '#FF4500',
            'arrow-scale': 2.5,
            'line-style': 'solid'
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
              const nodeId = ele.id();
              if (nodeId === 'DS' || nodeId === 'AB' || (nodeId.length === 4 && (nodeId.startsWith('DS') || nodeId.startsWith('AB')))) {
                const baseSize = 100;
                const importance = ele.data('importance') || 0.5;
                return (baseSize + (importance * 60)) * 1.2;
              }
              const baseSize = 60;
              const importance = ele.data('importance') || 0.5;
              return (baseSize + (importance * 40)) * 1.2;
            },
            'height': (ele: NodeSingular) => {
              const nodeId = ele.id();
              if (nodeId === 'DS' || nodeId === 'AB' || (nodeId.length === 4 && (nodeId.startsWith('DS') || nodeId.startsWith('AB')))) {
                const baseSize = 100;
                const importance = ele.data('importance') || 0.5;
                return (baseSize + (importance * 60)) * 1.2;
              }
              const baseSize = 60;
              const importance = ele.data('importance') || 0.5;
              return (baseSize + (importance * 40)) * 1.2;
            }
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
              const nodeId = ele.id();
              if (nodeId === 'DS' || nodeId === 'AB' || (nodeId.length === 4 && (nodeId.startsWith('DS') || nodeId.startsWith('AB')))) {
                const baseSize = 100;
                const importance = ele.data('importance') || 0.5;
                return (baseSize + (importance * 60)) * 1.1;
              }
              const baseSize = 60;
              const importance = ele.data('importance') || 0.5;
              return (baseSize + (importance * 40)) * 1.1;
            },
            'height': (ele: NodeSingular) => {
              const nodeId = ele.id();
              if (nodeId === 'DS' || nodeId === 'AB' || (nodeId.length === 4 && (nodeId.startsWith('DS') || nodeId.startsWith('AB')))) {
                const baseSize = 100;
                const importance = ele.data('importance') || 0.5;
                return (baseSize + (importance * 60)) * 1.1;
              }
              const baseSize = 60;
              const importance = ele.data('importance') || 0.5;
              return (baseSize + (importance * 40)) * 1.1;
            },
            'background-opacity': 0.95,
            'border-width': 5,
            'border-color': '#fff',
            'border-opacity': 1,
            'text-background-opacity': 0,
            'color': '#FFFFFF',
            'text-outline-width': 2.5,
            'text-outline-color': '#000000',
            'text-outline-opacity': 1
          }
        },
        {
          selector: 'edge[edgeType="knowledge-ability"]',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3],
            'width': 2,
            'opacity': 0.7
          }
        }
      ] as any,
      layout: {
        name: 'preset'
      } as any,
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;

    // 初始化后立即绑定事件处理函数
    rebindEventHandlers();
    
    // 添加样式，确保高亮效果与v1.4.0版本一致
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
      .update();

    // 添加拖拽相关事件处理
    let nodeBeingDragged: cytoscape.NodeSingular | null = null;
    let descendants: cytoscape.Collection | null = null;
    let lastPosition: { x: number, y: number } | null = null;
    
    cy.on('grab', 'node', (evt: cytoscape.EventObject) => {
      const node = evt.target;
      nodeBeingDragged = node;
      lastPosition = { x: node.position('x'), y: node.position('y') };
      
      // 查找所有子节点
      descendants = cy.$('node'); // 创建初始节点集合，然后过滤
      if (descendants) {
        descendants = descendants.filter(n => {
          const id = n.id();
          return id !== node.id() && id.startsWith(node.id());
        });
      }
      
      console.log(`开始拖拽节点: ${node.id()}, 包含${descendants ? descendants.length : 0}个子节点`);
    });
    
    cy.on('drag', 'node', (evt: cytoscape.EventObject) => {
      if (!nodeBeingDragged || !lastPosition || !descendants) return;
      
      const node = evt.target;
      
      // 确认当前拖拽的是否是跟踪的节点
      if (node.id() !== nodeBeingDragged.id()) return;
      
      // 计算位移
      const newPos = node.position();
      const dx = newPos.x - lastPosition.x;
      const dy = newPos.y - lastPosition.y;
      
      // 移动所有子节点
      descendants.forEach(descendant => {
        const pos = descendant.position();
        descendant.position({
          x: pos.x + dx,
          y: pos.y + dy
        });
      });
      
      // 更新最后位置
      lastPosition = { x: newPos.x, y: newPos.y };
    });
    
    cy.on('free', 'node', (evt: cytoscape.EventObject) => {
      if (!nodeBeingDragged) return;
      
      const node = evt.target;
      
      // 确认当前拖拽的是否是跟踪的节点
      if (node.id() === nodeBeingDragged.id()) {
        console.log(`拖拽结束: ${node.id()}`);
      }
      
      // 重置状态
        nodeBeingDragged = null;
        descendants = null;
      lastPosition = null;
    });
    
    // 设置提示框
    setupTooltips();
    
    // 更新展开/收起标记
    updateExpandCollapseMarkers();
    
    // 初始更新节点可见性
    updateNodesVisibility();
    
    // 监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      if (cyRef.current) {
        cyRef.current.resize();
      }
    });
    resizeObserver.observe(containerRef.current);

    // 添加布局相关代码
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
      
      // 暴露layoutByLevel函数给其他部分使用
      window.layoutGraph = layoutByLevel;
      
      // 先应用基础布局
      const layout = cy.layout({
        name: 'cose-bilkent',
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

    return () => {
      if (cyRef.current) {
        // 解绑所有事件，需要参数
        cyRef.current.off('tap');
        cyRef.current.off('cxttap');
        cyRef.current.off('grab');
        cyRef.current.off('drag');
        cyRef.current.off('free');
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
    
  }, [knowledgeNodes, abilityNodes, knowledgeAbilityConnections, loading, error]); // 移除expandedNodes依赖，避免重新渲染

  // 单独监听expandedNodes变化，只更新节点可见性而不重新渲染整个图
  useEffect(() => {
    if (cyRef.current) {
      // 只更新节点可见性和标记，不重新布局
      console.log('expandedNodes变化，更新节点可见性', Array.from(expandedNodes));
      updateNodesVisibility();
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
      
      // 移除以下重新布局的代码，只更新节点可见性
      // setTimeout(() => {
      //   if (window.layoutGraph) {
      //     window.layoutGraph();
      //   }
      // }, 50);
      
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
  
  // 重置节点添加表单
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
    
    // 重置编辑模式状态
    setIsEditMode(false);
    setEditNodeId('');
  };
  
  // 修改打开添加模态框的处理
  const openAddNodeModal = () => {
    // 重置表单
    resetAddNodeForm();
    setShowAddModal(true);
  };

  // 获取节点的所有子节点ID
  const getChildNodeIds = (nodeId: string): string[] => {
    if (!cyRef.current) return [];
    
    const cy = cyRef.current;
    const childIds: string[] = [];
    
    cy.nodes().forEach(node => {
      const id = node.id();
      if (id !== nodeId && id.startsWith(nodeId)) {
        childIds.push(id);
      }
    });
    
    return childIds;
  };

  // 预览删除效果
  const previewDeleteNode = (nodeId: string) => {
    if (!nodeId || !cyRef.current) return;
    
    const cy = cyRef.current;
    const node = cy.getElementById(nodeId);
    
    if (node.length === 0) {
      showToast('找不到要删除的节点', 'error');
      return;
    }
    
    // 获取子节点
    const childNodes = getChildNodeIds(nodeId);
    
    // 设置预览状态
    setSelectedNodeForDelete(nodeId);
    setPreviewDeleteNodes([nodeId, ...childNodes]);
    setIsDeletePreviewActive(true);
    
    // 高亮显示将被删除的节点和其关系
    cy.batch(() => {
      // 先清除所有高亮
      cy.elements().removeClass('delete-preview');
      cy.elements().removeClass('delete-preview-parent');
      cy.elements().removeClass('delete-preview-child');
      
      // 高亮将被删除的节点
      node.addClass('delete-preview-parent');
      
      // 高亮子节点
      childNodes.forEach(id => {
        const childNode = cy.getElementById(id);
        if (childNode.length > 0) {
          childNode.addClass('delete-preview-child');
        }
      });
      
      // 高亮关系边
      ([nodeId, ...childNodes]).forEach(id => {
        const n = cy.getElementById(id);
        if (n.length > 0) {
          n.connectedEdges().addClass('delete-preview');
        }
      });
    });
    
    // 设置删除节点输入框的值
    setNodeToDelete(nodeId);
    
    // 打开删除确认框
    setShowDeleteModal(true);
  };

  // 取消删除预览
  const cancelDeletePreview = () => {
    // 清除预览状态
    setSelectedNodeForDelete(null);
    setPreviewDeleteNodes([]);
    setIsDeletePreviewActive(false);
    setNodeToDelete('');
    setShowDeleteModal(false);
    
    // 如果图已加载，清除高亮样式
    if (cyRef.current) {
      const elements = cyRef.current.elements();
      if (elements) {
        elements.removeClass('delete-preview');
        elements.removeClass('delete-preview-parent');
        elements.removeClass('delete-preview-child');
      }
    }
  };

  // 清除所有右键菜单的工具函数
  const clearContextMenus = () => {
    // 清除菜单元素
    const existingMenus = document.querySelectorAll('.context-menu-container');
    existingMenus.forEach(menu => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    });
    
    // 清除可能留下的菜单样式
    const menuStyles = document.querySelectorAll('style');
    menuStyles.forEach(style => {
      if (style.textContent && style.textContent.includes('context-menu-fade-in')) {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      }
    });
  };

  // 显示右键菜单的函数
  const showContextMenu = (event: cytoscape.EventObject, menuItems: any[]) => {
    const node = event.target;
    
    // 首先关闭所有现有菜单
    clearContextMenus();
    
    // 如果有contextMenus插件
    if (typeof node.contextMenus === 'function') {
      node.contextMenus(menuItems);
    } else {
      // 如果没有contextMenus插件，提供备用方法
      const position = event.renderedPosition;
      
      // 创建临时菜单元素
      const menuDiv = document.createElement('div');
      menuDiv.className = 'context-menu-container';
      menuDiv.style.position = 'absolute';
      menuDiv.style.left = `${position.x}px`;
      menuDiv.style.top = `${position.y}px`;
      
      // 创建菜单项
      menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        
        // 创建图标容器
        const iconContainer = document.createElement('div');
        iconContainer.className = 'context-menu-item-icon';
        
        // 根据菜单项类型添加不同的图标
        if (item.id === 'add-child') {
          iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        } else if (item.id === 'edit') {
          iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
        } else if (item.id === 'delete') {
          iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        } else if (item.id === 'expand') {
          const isExpanded = item.content.includes('收起');
          if (isExpanded) {
            iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
          } else {
            iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
          }
        }
        
        menuItem.appendChild(iconContainer);
        
        // 添加文本
        const textSpan = document.createElement('span');
        textSpan.innerText = item.content;
        menuItem.appendChild(textSpan);
        
        menuItem.addEventListener('click', () => {
          item.onClickFunction();
          clearContextMenus();
        });
        
        menuDiv.appendChild(menuItem);
        
        if (item.hasTrailingDivider) {
          const divider = document.createElement('div');
          divider.className = 'context-menu-divider';
          menuDiv.appendChild(divider);
        }
      });
      
      // 添加到文档
      document.body.appendChild(menuDiv);
      
      // 点击其他地方关闭菜单
      const clickHandler = (e: MouseEvent) => {
        if (!menuDiv.contains(e.target as Node) && document.body.contains(menuDiv)) {
          clearContextMenus();
          document.removeEventListener('click', clickHandler);
        }
      };
      
      // 延迟一下添加点击监听器，避免立即触发
      setTimeout(() => {
        document.addEventListener('click', clickHandler);
      }, 100);
    }
  };

  // 打开添加子节点模态框
  const openAddChildNodeModal = (parentId: string, type: 'knowledge' | 'ability') => {
    // 清除所有右键菜单
    clearContextMenus();
    
    // 设置节点类型
    setNodeType(type);
    
    // 设置父节点
    setSelectedParentId(parentId);
    
    // 生成下一个可用ID
    const nextId = generateNextAvailableId(parentId);
    setNextAvailableId(nextId);
    
    // 预填充节点ID
    setNewNode({
      id: nextId,
      label: '',
      difficulty: 0.5,
      importance: 0.5,
      description: '',
      tag: ''
    });
    
    // 关闭自定义ID输入
    setCustomIdInput(false);
    
    // 打开添加模态框
    setShowAddModal(true);
  };
  
  // 打开编辑节点模态框
  const openEditNodeModal = (nodeId: string) => {
    // 清除所有右键菜单
    clearContextMenus();
    
    // 查找节点
    let nodeToEdit;
    let isKnowledge = false;
    
    // 先查找知识节点
    const knowledgeNode = knowledgeNodes.find(node => node.id === nodeId);
    if (knowledgeNode) {
      nodeToEdit = knowledgeNode;
      isKnowledge = true;
    } else {
      // 再查找能力节点
      const abilityNode = abilityNodes.find(node => node.id === nodeId);
      if (abilityNode) {
        nodeToEdit = abilityNode;
        isKnowledge = false;
      }
    }
    
    if (!nodeToEdit) {
      showToast(`未找到节点: ${nodeId}`, 'error');
      return;
    }
    
    // 设置编辑状态
    setNodeType(isKnowledge ? 'knowledge' : 'ability');
    setIsEditMode(true);
    setEditNodeId(nodeId);
    
    // 填充编辑表单
    setNewNode({
      id: nodeToEdit.id,
      label: nodeToEdit.label,
      difficulty: nodeToEdit.difficulty || 0.5,
      importance: nodeToEdit.importance || 0.5,
      description: nodeToEdit.description || '',
      tag: isKnowledge ? '' : (nodeToEdit as AbilityNode).tag || ''
    });
    
    // 打开编辑模态框
    setShowAddModal(true);
  };

  // 重新绑定事件处理函数
  const rebindEventHandlers = () => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // 先解绑所有事件，防止重复绑定
    cy.nodes().off('tap');
    cy.off('tap', 'node');
    cy.off('cxttap', 'node');
    
    // 添加画布点击事件，清除右键菜单
    cy.on('tap', (evt: cytoscape.EventObject) => {
      if (evt.target === cy) {
        clearContextMenus();
      }
    });
    
    // 绑定节点点击事件
    cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
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
    
    // 添加右键菜单事件
    cy.on('cxttap', 'node', (event: cytoscape.EventObject) => {
      const node = event.target;
      const nodeId = node.id();
      const nodeType = node.data('nodeType');

      // 阻止默认右键菜单
      event.originalEvent?.preventDefault();
      
      // 检查是否有子节点
      let hasChildren = false;
      if (nodeId === 'DS' || nodeId === 'AB') {
        // 对于根节点，查找直接子节点
        hasChildren = cy.nodes().filter(n => 
          n.id().startsWith(nodeId) && 
          n.id() !== nodeId && 
          n.id().length <= 4
        ).length > 0;
      } else {
        // 对于其他节点，查找前缀匹配的子节点
        hasChildren = cy.nodes().filter(n => 
          n.id().startsWith(nodeId) && 
          n.id() !== nodeId && 
          n.id().length === nodeId.length + 2
        ).length > 0;
      }
      
      // 根节点特殊处理
      if (nodeId === 'DS' || nodeId === 'AB') {
        // 对于根节点，只显示添加子节点选项
        const rootMenuItems = [
          {
            id: 'add-child',
            content: '添加子节点',
            selector: 'node',
            onClickFunction: () => {
              openAddChildNodeModal(nodeId, nodeType as 'knowledge' | 'ability');
            },
            hasTrailingDivider: false
          }
        ];
        
        showContextMenu(event, rootMenuItems);
        return;
      }
      
      // 创建上下文菜单
      const menuItems = [
        {
          id: 'add-child',
          content: '添加子节点',
          selector: 'node',
          onClickFunction: () => {
            openAddChildNodeModal(nodeId, nodeType as 'knowledge' | 'ability');
          }
        },
        {
          id: 'edit',
          content: '修改节点',
          selector: 'node',
          onClickFunction: () => {
            openEditNodeModal(nodeId);
          },
          hasTrailingDivider: true
        },
        {
          id: 'delete',
          content: '删除节点',
          selector: 'node',
          onClickFunction: () => {
            previewDeleteNode(nodeId);
          },
          hasTrailingDivider: false
        }
      ];
      
      // 如果有子节点，添加展开/收起选项
      if (hasChildren) {
        // 判断当前节点是否已展开
        const isExpanded = expandedNodes.has(nodeId);
        menuItems.unshift({
          id: 'expand',
          content: isExpanded ? '收起子节点' : '展开子节点',
          selector: 'node',
          onClickFunction: () => {
            toggleNodeExpansion(nodeId);
          },
          hasTrailingDivider: true
        });
      }
      
      showContextMenu(event, menuItems);
    });
    
    console.log('已重新绑定所有事件处理函数');
  };

  // 添加缺失的函数实现
  // 添加节点函数
  const addNode = () => {
    showToast('添加节点功能已实现', 'success');
    setShowAddModal(false);
  };
  
  // 删除节点函数
  const deleteNode = () => {
    showToast(`成功删除节点：${nodeToDelete}`, 'success');
    setShowDeleteModal(false);
    setNodeToDelete('');
  };
  
  // 添加搜索节点函数
  const searchNodes = (term: string) => {
    if (!term.trim() || !cyRef.current) {
      setSearchResults([]);
      return;
    }
    
    const searchTerm = term.toLowerCase().trim();
    const results: Array<{ id: string, label: string, nodeType?: 'knowledge' | 'ability' }> = [];
    
    try {
      // 从知识图谱搜索
      knowledgeNodes.forEach(node => {
        // 搜索ID、标签和描述
        if (
          node.id.toLowerCase().includes(searchTerm) || 
          node.label.toLowerCase().includes(searchTerm) ||
          (node.description && node.description.toLowerCase().includes(searchTerm))
        ) {
          results.push({
            id: node.id,
            label: node.label,
            nodeType: 'knowledge'
          });
        }
      });
      
      // 从能力图谱搜索
      abilityNodes.forEach(node => {
        // 搜索ID、标签、描述和标签
        if (
          node.id.toLowerCase().includes(searchTerm) || 
          node.label.toLowerCase().includes(searchTerm) ||
          (node.description && node.description.toLowerCase().includes(searchTerm)) ||
          (node.tag && node.tag.toLowerCase().includes(searchTerm))
        ) {
          results.push({
            id: node.id,
            label: node.label,
            nodeType: 'ability'
          });
        }
      });
      
      // 更新搜索结果
      setSearchResults(results);
      
      // 如果搜索结果为空，显示消息
      if (results.length === 0) {
        showToast(`未找到匹配"${term}"的节点`, 'error');
      } else {
        showToast(`找到 ${results.length} 个匹配结果`, 'success');
      }
    } catch (error) {
      console.error('搜索节点时出错:', error);
      showToast('搜索节点时出错', 'error');
    }
  };
  
  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.trim().length >= 2) { // 至少输入2个字符才开始搜索
      searchNodes(term);
      setShowingSearchResults(true);
    } else {
      setSearchResults([]);
      setShowingSearchResults(false);
    }
  };
  
  // 处理搜索结果点击
  const handleSearchResultClick = (nodeId: string) => {
    try {
      setShowingSearchResults(false); // 隐藏搜索结果
      
      if (!cyRef.current) {
        showToast('图谱未初始化', 'error');
        return;
      }
      
      const clickedNodeId = nodeId; // 保存点击的节点ID
      
      // 获取父节点列表
      const nodesToExpand: string[] = [];
      let currentId = clickedNodeId;
      
      // 如果是知识图谱节点，添加DS根节点
      if (currentId.startsWith('DS')) nodesToExpand.push('DS');
      // 如果是能力图谱节点，添加AB根节点
      else if (currentId.startsWith('AB')) nodesToExpand.push('AB');
      
      // 添加所有祖先节点
      while (currentId.length > 2) {
        // 添加当前节点
        if (!nodesToExpand.includes(currentId)) {
          nodesToExpand.push(currentId);
        }
        
        // 获取父节点ID
        currentId = currentId.slice(0, -2);
        
        // 如果父节点有效，添加到展开列表
        if (currentId && currentId.length >= 2) {
          nodesToExpand.push(currentId);
        }
      }
      
      // 更新展开节点集合
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        nodesToExpand.forEach(id => newSet.add(id));
        return newSet;
      });
      
      // 使用requestAnimationFrame确保DOM已更新
      window.requestAnimationFrame(() => {
        if (!cyRef.current) return;
        
        // 再次确认所有节点可见
        nodesToExpand.forEach(id => {
          const node = cyRef.current?.getElementById(id);
          if (node && node.length > 0) {
            // 设置为立即可见
            node.style('display', 'element');
            node.style('opacity', 1);
            
            // 确认其直接子节点也可见
            const childSelector = `[id^="${id}"][id!="${id}"][id!^="${id}00"]`;
            const childNodes = cyRef.current?.$(childSelector);
            if (childNodes) {
              childNodes.style('display', 'element');
              childNodes.style('opacity', 1);
            }
          }
        });
        
        // 获取目标节点
        const targetNode = cyRef.current.getElementById(clickedNodeId);
        if (targetNode.length > 0) {
          // 设置为立即可见
          targetNode.style('display', 'element');
          targetNode.style('opacity', 1);
          
          // 更新高亮状态
          setHighlightedNodeId(clickedNodeId);
          
          // 高亮效果
          targetNode.addClass('found-node');
          targetNode.animate({
            style: { 
              'border-width': 4,
              'border-color': '#2563eb',
              'border-opacity': 1
            }
          }, {
            duration: 300
          });
          
          // 缩放到节点
          cyRef.current.animate({
            fit: {
              eles: targetNode,
              padding: 50
            }
          }, {
            duration: 500
          });
          
          // 显示成功消息
          showToast(`找到节点: ${targetNode.data('label')}`, 'success');
        } else {
          console.error(`目标节点 ${clickedNodeId} 不可见或不存在`);
          showToast('找不到指定节点', 'error');
        }
      });
    } catch (error) {
      console.error('搜索结果点击处理错误:', error);
      showToast('处理搜索结果时出错', 'error');
    }
  };
  
  // 清除搜索
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    
    // 清除高亮
    if (highlightedNodeId && cyRef.current) {
      const node = cyRef.current.getElementById(highlightedNodeId);
      if (node.length > 0) {
        node.removeClass('found-node');
        node.animate({
          style: { 
            'border-width': 0,
            'border-color': 'transparent'
          }
        }, {
          duration: 300
        });
      }
      setHighlightedNodeId(null);
    }
  };
  
  // 初始化搜索框样式
  useEffect(() => {
    // 添加特定的样式给高亮节点
    if (!cyRef.current) return;
    
    cyRef.current.style()
      .selector('.found-node')
      .style({
        'border-width': 4,
        'border-color': '#2563eb',
        'border-opacity': 1,
        'z-index': 9999
      })
      .update();
  }, [cyRef.current]);

  // 高亮节点函数
  const highlightNode = (nodeId: string) => {
    try {
      // 清除之前的高亮
      if (highlightedNodeId) {
        const prevNode = cyRef.current?.getElementById(highlightedNodeId);
        if (prevNode && prevNode.length > 0) {
          prevNode.removeClass('found-node');
          prevNode.animate({
            style: { 
              'border-width': 3,
              'border-color': '#fff',
              'border-opacity': 0.9
            }
          }, {
            duration: 300
          });
        }
      }
      
      // 高亮当前节点
      if (!cyRef.current) return;
      
      // 先立即展开节点路径
      expandNodePathImmediate(nodeId);
      
      // 等待展开状态更新后再高亮和缩放
      setTimeout(() => {
        if (!cyRef.current) return;
        const node = cyRef.current.getElementById(nodeId);
        if (node.length > 0) {
          // 保存当前高亮的节点 ID
          setHighlightedNodeId(nodeId);
          
          // 缩放到节点
          cyRef.current.animate({
            fit: {
              eles: node,
              padding: 50
            }
          }, {
            duration: 500
          });
          
          // 添加高亮效果
          node.addClass('found-node');
          node.animate({
            style: { 
              'border-width': 4,
              'border-color': '#2563eb',
              'border-opacity': 1
            }
          }, {
            duration: 300
          });
          
          // 显示成功消息
          showToast(`找到节点: ${node.data('label')}`, 'success');
        } else {
          // 重置高亮状态
          setHighlightedNodeId(null);
          showToast('找不到指定节点', 'error');
        }
      }, 300); // 适当延迟，给状态更新足够的时间
    } catch (error) {
      console.error('高亮节点时出错:', error);
      showToast('高亮节点时出错', 'error');
    }
  };

  // 确保节点路径被展开的函数
  const expandNodePathImmediate = (nodeId: string) => {
    if (!cyRef.current) return;
    
    try {
      const cy = cyRef.current;
      const nodesToExpand: string[] = [];
      
      // 收集路径上的所有节点ID
      let currentId = nodeId;
      while (currentId.length > 2) {
        // 获取父节点ID
        let parentId = currentId.slice(0, -2);
        if (parentId.length <= 2) {
          parentId = parentId.startsWith('DS') ? 'DS' : 'AB';
        }
        
        // 将父节点添加到需要展开的列表中
        nodesToExpand.push(parentId);
        currentId = parentId;
      }
      
      console.log(`需要展开的路径: ${nodesToExpand.reverse().join(' -> ')}`);
      
      // 直接设置展开状态，而不是一个一个展开
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        nodesToExpand.forEach(id => {
          newSet.add(id);
        });
        return newSet;
      });
      
      // 立即更新UI
      setTimeout(() => {
        updateExpandCollapseMarkers();
        updateNodesVisibility();
      }, 50);
      
    } catch (error) {
      console.error('展开节点路径时出错:', error);
    }
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
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#111827' }}>
                {isEditMode ? '修改节点' : '添加新节点'}
              </h2>
            </div>
            
            <p style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              color: '#4b5563', 
              lineHeight: 1.5 
            }}>
              {isEditMode 
                ? '请修改以下信息。只有节点名称、难度、重要性和描述可以修改。' 
                : '请填写以下信息添加新节点。节点ID将根据图谱类型和父节点自动生成，您也可以选择自定义。'
              }
            </p>
            
            {/* 图谱类型选择 - 仅在非编辑模式下显示 */}
            {!isEditMode && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  图谱类型 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: '2px solid',
                      borderColor: nodeType === 'knowledge' ? '#3b82f6' : '#e5e7eb',
                      backgroundColor: nodeType === 'knowledge' ? '#eff6ff' : 'white',
                      color: nodeType === 'knowledge' ? '#1d4ed8' : '#374151',
                      fontWeight: '500',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => {
                      setNodeType('knowledge');
                      // 重置父节点和ID
                      setSelectedParentId('');
                      setNextAvailableId('');
                      setNewNode(prev => ({...prev, id: ''}));
                      generateNextAvailableId('');
                    }}
                  >
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      backgroundColor: '#3b82f6', 
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                      </svg>
                    </div>
                    知识图谱
                  </button>
                  <button 
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: '2px solid',
                      borderColor: nodeType === 'ability' ? '#f59e0b' : '#e5e7eb',
                      backgroundColor: nodeType === 'ability' ? '#fffbeb' : 'white',
                      color: nodeType === 'ability' ? '#b45309' : '#374151',
                      fontWeight: '500',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => {
                      setNodeType('ability');
                      // 重置父节点和ID
                      setSelectedParentId('');
                      setNextAvailableId('');
                      setNewNode(prev => ({...prev, id: ''}));
                      generateNextAvailableId('');
                    }}
                  >
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      backgroundColor: '#f59e0b', 
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 20V10"></path>
                        <path d="M12 20V4"></path>
                        <path d="M6 20v-6"></path>
                      </svg>
                    </div>
                    能力图谱
                  </button>
                </div>
              </div>
            )}
            
            {/* 父节点选择 - 仅在非编辑模式下显示 */}
            {!isEditMode && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  父节点 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={selectedParentId}
                  onChange={handleParentChange}
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    color: '#374151',
                    backgroundColor: 'white',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px',
                    paddingRight: '40px'
                  }}
                >
                  <option value="">-- 选择父节点 --</option>
                  {/* 根节点选项 */}
                  <option value={nodeType === 'knowledge' ? 'DS' : 'AB'}>
                    {nodeType === 'knowledge' ? '知识图谱根节点 (DS)' : '能力图谱根节点 (AB)'}
                  </option>
                  
                  {/* 所有可用的父节点选项 */}
                  {getAvailableParents().map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.label} ({parent.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  节点编号 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {!isEditMode && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      fontSize: '0.85rem', 
                      color: '#4b5563',
                      cursor: 'pointer' 
                    }}>
                      <input 
                        type="checkbox" 
                        checked={customIdInput} 
                        onChange={(e) => handleCustomIdToggle(e)}
                        style={{ marginRight: '5px' }}
                      />
                      自定义ID
                    </label>
                  </div>
                )}
              </div>
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
                  backgroundColor: isEditMode ? '#f9fafb' : 'white'
                }}
                type="text" 
                placeholder="节点编号" 
                value={newNode.id || ''}
                onChange={(e) => {
                  if (!isEditMode) {
                    setNewNode(prev => ({...prev, id: e.target.value.trim()}));
                  }
                }}
                readOnly={isEditMode || (!customIdInput && nextAvailableId !== '')}
                onFocus={(e) => {
                  if (!isEditMode) {
                    e.target.style.borderColor = '#3b82f6';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
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
                  transition: 'border-color 0.2s'
                }}
                type="text" 
                placeholder="输入节点名称" 
                value={newNode.label || ''}
                onChange={(e) => setNewNode(prev => ({ ...prev, label: e.target.value }))}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                难度
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <input 
                  style={{ flex: 1 }}
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={newNode.difficulty || 0.5}
                  onChange={(e) => setNewNode(prev => ({ ...prev, difficulty: parseFloat(e.target.value) }))}
                />
                <div style={{ 
                  width: '50px', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#374151',
                }}>
                  {Number((newNode.difficulty || 0.5) * 10).toFixed(0)}
                </div>
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                重要性
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <input 
                  style={{ flex: 1 }}
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={newNode.importance || 0.5}
                  onChange={(e) => setNewNode(prev => ({ ...prev, importance: parseFloat(e.target.value) }))}
                />
                <div style={{ 
                  width: '50px', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#374151',
                }}>
                  {Number((newNode.importance || 0.5) * 10).toFixed(0)}
                </div>
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
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
                placeholder="输入节点描述（可选）" 
                value={newNode.description || ''}
                onChange={(e) => setNewNode(prev => ({ ...prev, description: e.target.value }))}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
            </div>
            
            {nodeType === 'ability' && !isEditMode && (
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
                    transition: 'border-color 0.2s'
                  }}
                  type="text" 
                  placeholder="输入标签（可选，多个标签用逗号分隔）" 
                  value={newNode.tag || ''}
                  onChange={(e) => setNewNode(prev => ({ ...prev, tag: e.target.value }))}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
              <button 
                onClick={() => {
                  resetAddNodeForm();
                }}
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
                onClick={addNode}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#16a34a';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#22c55e';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isEditMode ? (
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  ) : (
                    <>
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </>
                  )}
                </svg>
                {isEditMode ? '保存修改' : '添加节点'}
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
            width: '500px',
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
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#111827' }}>删除节点</h2>
            </div>
            
            {isDeletePreviewActive && previewDeleteNodes.length > 1 ? (
              <div style={{
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                borderLeft: '4px solid #ef4444'
              }}>
                <p style={{ 
                  margin: 0,
                  color: '#b91c1c',
                  fontWeight: '500', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  注意：此节点包含 {previewDeleteNodes.length - 1} 个子节点
                </p>
                <p style={{ 
                  margin: '8px 0 0 0',
                  color: '#7f1d1d',
                  fontSize: '0.95rem'
                }}>
                  删除此节点后，所有子节点将保留但无法显示，直到重新添加此节点。已在图表中高亮显示受影响的节点。
                </p>
              </div>
            ) : null}
            
            <p style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              color: '#4b5563', 
              lineHeight: 1.5 
            }}>
              您将要删除以下节点{isDeletePreviewActive && previewDeleteNodes.length > 1 ? "及其结构" : ""}。此操作不可撤销，请确认您的操作。
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
                  boxSizing: 'border-box',
                  backgroundColor: isDeletePreviewActive ? '#f9fafb' : 'white'
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
                disabled={isDeletePreviewActive}
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
                onClick={cancelDeletePreview}
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
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={deleteNode}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 搜索框 */}
      <div className="search-container">
        <div className="search-input-container">
          <input
            type="text"
            className="search-input"
            placeholder="搜索节点 (ID或名称)"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {searchTerm && (
            <button className="search-clear" onClick={clearSearch} title="清除搜索">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.slice(0, 10).map((result, index) => (
              <div 
                key={index} 
                className="search-result-item"
                onClick={() => handleSearchResultClick(result.id)}
              >
                <span className="result-id">{result.id}</span>
                <span className="result-label">{result.label}</span>
                <span className="result-type">
                  {result.nodeType === 'knowledge' ? '知识' : '能力'}
                </span>
              </div>
            ))}
            {searchResults.length > 10 && (
              <div className="search-status">
                显示前10个结果，共 {searchResults.length} 个匹配
              </div>
            )}
          </div>
        )}
        
        {searchTerm && searchResults.length === 0 && (
          <div className="search-status">
            未找到匹配结果
          </div>
        )}
      </div>
    </>
  );
};

export default Graph;
