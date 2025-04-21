import { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { KnowledgeNode, AbilityNode } from '../utils/excelReader';
import { Node3D, Edge3D, ToastMessage, ContextMenuItem, SearchResult } from '../types';

// 定义3D节点类型
export interface Node3D {
  id: string;
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  nodeType: 'knowledge' | 'ability';
  difficulty: number;
  importance: number;
  description?: string;
  tag?: string;
  position: THREE.Vector3;
  color: string;
  radius: number;
  children: Node3D[];
  isExpanded: boolean;
}

// 定义3D边类型
export interface Edge3D {
  source: string;
  target: string;
  sourcePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

// 定义提示信息类型
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// 上下文菜单项类型
export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
}

export const useGraph3DInteractions = () => {
  // 节点状态
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['DS', 'AB']));
  const [nodes3D, setNodes3D] = useState<Node3D[]>([]);
  const [edges3D, setEdges3D] = useState<Edge3D[]>([]);
  
  // 上下文菜单状态
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    nodeId?: string;
    position?: THREE.Vector3;
    items: ContextMenuItem[];
  }>({
    show: false,
    x: 0,
    y: 0,
    items: []
  });
  
  // 提示消息状态
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // 搜索相关状态
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  /**
   * 显示提示消息
   */
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  }, []);
  
  /**
   * 处理节点点击 - 展开/收起
   */
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log("节点点击:", nodeId);
    
    // 更新选中节点
    setSelectedNodeId(nodeId);
    
    // 更新展开状态
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      
      // 切换展开状态
      if (newSet.has(nodeId)) {
        console.log("收起节点:", nodeId);
        newSet.delete(nodeId);
      } else {
        console.log("展开节点:", nodeId); 
        newSet.add(nodeId);
      }
      
      return newSet;
    });
  }, []);
  
  /**
   * 处理节点拖拽开始
   */
  const handleDragStart = useCallback((nodeId: string, position: THREE.Vector3) => {
    console.log(`开始拖拽节点: ${nodeId}`, position);
  }, []);
  
  /**
   * 处理节点拖拽中
   */
  const handleDrag = useCallback((nodeId: string, position: THREE.Vector3) => {
    // 更新当前节点位置
    setNodes3D(nodes => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, position: position.clone() };
        }
        
        // 如果是子节点，也要跟随移动
        if (node.id.startsWith(nodeId) && node.id !== nodeId) {
          // 找到原始节点
          const originalNode = nodes.find(n => n.id === nodeId);
          if (originalNode) {
            // 计算位移
            const dx = position.x - originalNode.position.x;
            const dy = position.y - originalNode.position.y;
            
            // 应用位移
            return {
              ...node,
              position: new THREE.Vector3(
                node.position.x + dx,
                node.position.y + dy,
                node.position.z
              )
            };
          }
        }
        
        return node;
      });
    });
    
    // 更新边位置
    updateEdges();
  }, []);
  
  /**
   * 处理节点拖拽结束
   */
  const handleDragEnd = useCallback((nodeId: string) => {
    console.log(`结束拖拽节点: ${nodeId}`);
  }, []);
  
  /**
   * 处理节点右键点击，显示上下文菜单
   */
  const handleNodeRightClick = useCallback((event: MouseEvent, nodeId: string, position: THREE.Vector3) => {
    event.preventDefault();
    
    // 先关闭所有现有的上下文菜单
    clearContextMenus();
    
    // 构建菜单项
    const menuItems: ContextMenuItem[] = [
      {
        label: '添加子节点',
        onClick: () => {
          // 处理添加子节点逻辑
          const nodeType = nodeId.startsWith('DS') ? 'knowledge' : 'ability';
          openAddChildNodeModal(nodeId, nodeType);
        }
      },
      {
        label: '编辑节点',
        onClick: () => {
          // 处理编辑节点逻辑
          openEditNodeModal(nodeId);
        }
      },
      {
        label: '删除节点',
        onClick: () => {
          // 处理删除节点逻辑
          previewDeleteNode(nodeId);
        }
      }
    ];
    
    // 显示上下文菜单
    setContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY,
      nodeId,
      position,
      items: menuItems
    });
  }, []);
  
  /**
   * 清除上下文菜单
   */
  const clearContextMenus = useCallback(() => {
    setContextMenu(prev => ({
      ...prev,
      show: false
    }));
  }, []);
  
  /**
   * 更新边位置
   */
  const updateEdges = useCallback(() => {
    setEdges3D(edges => {
      return edges.map(edge => {
        // 查找源节点和目标节点
        const sourceNode = nodes3D.find(node => node.id === edge.source);
        const targetNode = nodes3D.find(node => node.id === edge.target);
        
        if (sourceNode && targetNode) {
          return {
            ...edge,
            sourcePosition: sourceNode.position.clone(),
            targetPosition: targetNode.position.clone()
          };
        }
        
        return edge;
      });
    });
  }, [nodes3D]);
  
  /**
   * 打开添加子节点模态框
   */
  const openAddChildNodeModal = useCallback((parentId: string, type: 'knowledge' | 'ability') => {
    // 这个方法的具体实现需要依赖于实际的模态框组件
    // 在实际使用时需要补充
    console.log(`打开添加子节点模态框: ${parentId}, 类型: ${type}`);
  }, []);
  
  /**
   * 打开编辑节点模态框
   */
  const openEditNodeModal = useCallback((nodeId: string) => {
    // 这个方法的具体实现需要依赖于实际的模态框组件
    // 在实际使用时需要补充
    console.log(`打开编辑节点模态框: ${nodeId}`);
  }, []);
  
  /**
   * 预览删除节点
   */
  const previewDeleteNode = useCallback((nodeId: string) => {
    // 这个方法的具体实现需要依赖于实际的删除预览组件
    // 在实际使用时需要补充
    console.log(`预览删除节点: ${nodeId}`);
  }, []);
  
  /**
   * 搜索节点
   */
  const searchNodes = useCallback((term: string, knowledgeNodes: KnowledgeNode[], abilityNodes: AbilityNode[]) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    
    const termLower = term.toLowerCase();
    const results: SearchResult[] = [];
    
    // 搜索知识节点
    knowledgeNodes.forEach(node => {
      if (
        node.id.toLowerCase().includes(termLower) ||
        node.label.toLowerCase().includes(termLower) ||
        (node.description && node.description.toLowerCase().includes(termLower))
      ) {
        const nodeType = getNodeType(node.id);
        results.push({
          id: node.id,
          label: node.label,
          type: nodeType,
          nodeType: 'knowledge'
        });
      }
    });
    
    // 搜索能力节点
    abilityNodes.forEach(node => {
      if (
        node.id.toLowerCase().includes(termLower) ||
        node.label.toLowerCase().includes(termLower) ||
        (node.description && node.description.toLowerCase().includes(termLower)) ||
        (node.tag && node.tag.toLowerCase().includes(termLower))
      ) {
        const nodeType = getNodeType(node.id);
        results.push({
          id: node.id,
          label: node.label,
          type: nodeType,
          nodeType: 'ability'
        });
      }
    });
    
    setSearchResults(results);
  }, []);
  
  /**
   * 处理搜索输入变化
   */
  const handleSearchChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    knowledgeNodes: KnowledgeNode[],
    abilityNodes: AbilityNode[]
  ) => {
    const term = e.target.value;
    setSearchTerm(term);
    searchNodes(term, knowledgeNodes, abilityNodes);
  }, [searchNodes]);
  
  /**
   * 处理搜索结果点击
   */
  const handleSearchResultClick = useCallback((nodeId: string) => {
    console.log(`搜索结果点击: ${nodeId}`);
    
    // 收集路径上的所有节点ID
    const nodesToExpand: string[] = [];
    let currentId = nodeId;
    
    // 从目标节点往上找到根节点的路径
    while (currentId.length > 2) {
      let parentId = currentId.slice(0, -2);
      if (parentId.length <= 2) {
        parentId = parentId.startsWith('DS') ? 'DS' : 'AB';
      }
      
      // 添加父节点到展开列表
      nodesToExpand.push(parentId);
      currentId = parentId;
    }
    
    // 直接一次性更新所有节点的展开状态
    console.log(`需要展开的路径: ${nodesToExpand.reverse().join(' -> ')}`);
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      nodesToExpand.forEach(id => newSet.add(id));
      return newSet;
    });
    
    // 设置选中节点
    setSelectedNodeId(nodeId);
    
    // 显示成功消息
    showToast(`找到节点: ${nodeId}`, 'success');
  }, [showToast]);
  
  /**
   * 清除搜索
   */
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
  }, []);
  
  /**
   * 获取节点类型
   */
  const getNodeType = (id: string): string => {
    const length = id.length;
    if (length <= 2) return 'chapter';
    if (length <= 4) return 'section';
    if (length <= 6) return 'subsection';
    if (length <= 8) return 'point';
    return 'detail';
  };
  
  return {
    // 状态
    selectedNodeId,
    setSelectedNodeId,
    expandedNodes,
    setExpandedNodes,
    nodes3D,
    setNodes3D,
    edges3D,
    setEdges3D,
    contextMenu,
    setContextMenu,
    toasts,
    setToasts,
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    
    // 方法
    showToast,
    handleNodeClick,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleNodeRightClick,
    clearContextMenus,
    updateEdges,
    searchNodes,
    handleSearchChange,
    handleSearchResultClick,
    clearSearch
  };
}; 