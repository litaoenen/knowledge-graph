import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { KnowledgeNode, AbilityNode, readExcelFile, readAbilityExcelFile } from './utils/excelReader';

// 导入安全组件
import SafeNodeObject from './components/SafeNodeObject';
import SafeEdgeObject from './components/SafeEdgeObject';
import SafeScene from './components/SafeScene';

// 节点类型，扩展以支持3D位置
interface Node3D {
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

// 边类型
interface Edge3D {
  source: string;
  target: string;
  sourcePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

// 主图谱组件
const Graph3D: React.FC = () => {
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [abilityNodes, setAbilityNodes] = useState<AbilityNode[]>([]);
  const [nodes3D, setNodes3D] = useState<Node3D[]>([]);
  const [edges3D, setEdges3D] = useState<Edge3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['DS', 'AB']));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
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
  const [isEditMode, setIsEditMode] = useState(false);
  
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
    setNodeType('knowledge');
    setShowAddModal(false);
    setSelectedParentId('');
    setCustomIdInput(false);
    setNextAvailableId('');
    setIsEditMode(false); // 重置编辑模式
  };
  
  // 打开添加节点模态框
  const openAddNodeModal = () => {
    setShowAddModal(true);
    // 默认生成下一个可用ID
    generateNextAvailableId('', nodeType);
  };
  
  // 生成下一个可用ID
  const generateNextAvailableId = (parentId: string, type: 'knowledge' | 'ability') => {
    let baseId = parentId || (type === 'knowledge' ? 'DS' : 'AB');
    let maxNum = 0;
    
    const nodes = type === 'knowledge' ? knowledgeNodes : abilityNodes;
    
    // 查找同级最大编号
    nodes.forEach(node => {
      if (parentId && node.id.startsWith(parentId) && node.id.length === parentId.length + 2) {
        const numPart = node.id.substring(parentId.length);
        const num = parseInt(numPart, 36);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      } else if (!parentId) {
        if ((type === 'knowledge' && node.id.startsWith('DS') && node.id.length === 4) ||
            (type === 'ability' && node.id.startsWith('AB') && node.id.length === 4)) {
          const numPart = node.id.substring(2);
          const num = parseInt(numPart, 36);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    
    // 生成下一个编号
    const nextNum = maxNum + 1;
    // 转换为36进制（0-9, A-Z）并保证两位长度
    let nextId = nextNum.toString(36).toUpperCase();
    if (nextId.length === 1) nextId = '0' + nextId;
    
    const newId = baseId + nextId;
    setNextAvailableId(newId);
    
    if (!customIdInput) {
      setNewNode(prev => ({ ...prev, id: newId }));
    }
    
    return newId;
  };
  
  // 处理父节点选择变化
  const handleParentChange = (parentId: string) => {
    setSelectedParentId(parentId);
    generateNextAvailableId(parentId, nodeType);
  };
  
  // 处理是否使用自定义ID变化
  const handleCustomIdChange = (isCustom: boolean) => {
    setCustomIdInput(isCustom);
    if (!isCustom) {
      // 如果切换回自动生成，则更新为当前计算的ID
      setNewNode(prev => ({ ...prev, id: nextAvailableId }));
    }
  };
  
  // 添加节点
  const addNode = () => {
    // 验证输入
    if (!newNode.label) {
      showToast('请输入节点名称', 'error');
      return;
    }
    
    // 使用typeScript提供的断言，确保id和label不为undefined
    const nodeId = newNode.id as string;
    
    if (!nodeId) {
      showToast('请输入或生成节点编号', 'error');
      return;
    }
    
    // 检查ID格式
    if (nodeType === 'knowledge' && !nodeId.startsWith('DS')) {
      showToast('知识图谱节点编号必须以DS开头', 'error');
      return;
    }
    
    if (nodeType === 'ability' && !nodeId.startsWith('AB')) {
      showToast('能力图谱节点编号必须以AB开头', 'error');
      return;
    }
    
    // 检查编辑模式
    if (isEditMode) {
      // 处理编辑现有节点
      if (nodeType === 'knowledge') {
        // 更新知识节点
        setKnowledgeNodes(prev => prev.map(node => 
          node.id === nodeId 
          ? {
              ...node,
              label: String(newNode.label).trim(),
              difficulty: newNode.difficulty || 0.5,
              importance: newNode.importance || 0.5,
              description: newNode.description
            }
          : node
        ));
        
        showToast(`成功更新知识节点: ${newNode.label}`, 'success');
      } else {
        // 更新能力节点
        setAbilityNodes(prev => prev.map(node => 
          node.id === nodeId 
          ? {
              ...node,
              label: String(newNode.label).trim(),
              name: String(newNode.label).trim(),
              difficulty: newNode.difficulty || 0.5,
              importance: newNode.importance || 0.5,
              description: newNode.description,
              tag: newNode.tag
            }
          : node
        ));
        
        showToast(`成功更新能力节点: ${newNode.label}`, 'success');
      }
      
      // 重置编辑模式
      setIsEditMode(false);
    } else {
      // 以下是添加新节点的逻辑
      
      // 检查ID是否已存在
      const isKnowledgeNodeExists = knowledgeNodes.some(node => node.id === nodeId);
      const isAbilityNodeExists = abilityNodes.some(node => node.id === nodeId);
      
      if (isKnowledgeNodeExists || isAbilityNodeExists) {
        showToast(`节点编号 ${nodeId} 已存在`, 'error');
        return;
      }
      
      // 使用类型断言确保id不为undefined
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
          label: String(newNode.label).trim(),
          type: nodeTypeFromId,
          difficulty: newNode.difficulty || 0.5,
          importance: newNode.importance || 0.5,
          description: newNode.description
        };
        
        setKnowledgeNodes(prev => [...prev, newKnowledgeNode]);
        
        // 检查是否有子节点需要连接
        const existingChildren = hasExistingChildren();
        
        // 如果是新增节点，需要展开其父节点
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
          label: String(newNode.label).trim(),
          name: String(newNode.label).trim(),
          type: nodeTypeFromId,
          difficulty: newNode.difficulty || 0.5,
          importance: newNode.importance || 0.5,
          description: newNode.description,
          tag: newNode.tag
        };
        
        setAbilityNodes(prev => [...prev, newAbilityNode]);
        
        // 检查是否有子节点需要连接
        const existingChildren = hasExistingChildren();
        
        // 如果是新增节点，需要展开其父节点
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
    }
    
    // 重置表单并关闭模态框
    resetAddNodeForm();
    
    // 使用两次更新确保显示正确
    setTimeout(() => {
      updateNodesAfterChange();
      // 再次延迟触发一次更新，确保节点标签正确显示
      setTimeout(() => {
        updateNodesAfterChange();
      }, 200);
    }, 100);
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
    } else {
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
    
    // 使用两次更新确保显示正确
    setTimeout(() => {
      updateNodesAfterChange();
      // 再次延迟触发一次更新，确保节点标签正确显示
      setTimeout(() => {
        updateNodesAfterChange();
      }, 200);
    }, 100);
  };
  
  // 获取节点的类型
  const getNodeType = (id: string): 'chapter' | 'section' | 'subsection' | 'point' | 'detail' => {
    const length = id.length;
    
    if (length <= 2) return 'chapter';
    if (length <= 4) return 'section';
    if (length <= 6) return 'subsection';
    if (length <= 8) return 'point';
    return 'detail';
  };
  
  // 更新节点后重新构建3D节点
  const updateNodesAfterChange = () => {
    // 构建知识节点树和能力节点树
    const knowledgeTree = buildNodeTree(knowledgeNodes, 'knowledge');
    const abilityTree = buildNodeTree(abilityNodes, 'ability');
    
    // 合并两棵树
    const allNodes = [...knowledgeTree, ...abilityTree];
    
    // 扁平化节点树
    const visibleNodes = flattenNodeTree(allNodes, expandedNodes);
    
    // 布局节点
    const layoutedNodes = layoutNodes(visibleNodes);
    
    // 更新状态
    setNodes3D(layoutedNodes);
    
    // 创建并更新边
    const newEdges = createEdges(layoutedNodes);
    setEdges3D(newEdges);
  };
  
  // 加载Excel数据
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
  
  // 处理节点点击 - 展开/收起
  const handleNodeClick = (nodeId: string) => {
    console.log("节点点击:", nodeId);
    
    // 立即更新selectedNodeId提升响应速度
    setSelectedNodeId(nodeId);
    
    // 立即更新展开状态，而不是使用requestAnimationFrame
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
  };
  
  // 处理节点拖拽开始
  const handleDragStart = (nodeId: string, position: THREE.Vector3) => {
    console.log(`开始拖拽节点: ${nodeId}`, position);
  };
  
  // 处理节点拖拽中
  const handleDrag = (nodeId: string, position: THREE.Vector3) => {
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
    
    // 更新边
    updateEdges();
  };
  
  // 处理节点拖拽结束
  const handleDragEnd = (nodeId: string) => {
    console.log(`结束拖拽节点: ${nodeId}`);
  };
  
  // 构建3D节点树
  const buildNodeTree = (nodes: (KnowledgeNode | AbilityNode)[], nodeType: 'knowledge' | 'ability'): Node3D[] => {
    // 创建节点映射
    const nodeMap = new Map<string, Node3D>();
    
    // 创建3D节点
    nodes.forEach(node => {
      const isKnowledge = nodeType === 'knowledge';
      // 知识图谱在底面，能力图谱在顶面
      const zLevel = isKnowledge ? -5 : 5; // 调整为-5和5
      
      // 确定节点颜色和大小
      let color = '#3a86ff';
      if (isKnowledge) {
        color = node.type === 'chapter' || node.type === 'section' ? '#3a86ff' : '#ff006e';
      } else {
        // 能力图谱使用金色调
        color = node.type === 'chapter' || node.type === 'section' ? '#ffd700' : '#ff9900';
      }
      
      // 创建初始3D节点
      nodeMap.set(node.id, {
        ...node,
        nodeType,
        children: [],
        position: new THREE.Vector3(0, 0, zLevel), // 初始位置在各自的平面上
        color,
        radius: 0.6 + (node.importance || 0.5) * 0.8,
        isExpanded: expandedNodes.has(node.id)
      });
    });
    
    // 构建树结构
    nodes.forEach(node => {
      if (node.id === 'DS' || node.id === 'AB') return;
      
      // 获取父节点ID
      let parentId = '';
      if ((node.id.startsWith('DS') || node.id.startsWith('AB')) && node.id.length > 2) {
        parentId = node.id.slice(0, -2);
        if (parentId === '') {
          parentId = node.id.startsWith('DS') ? 'DS' : 'AB';
        }
      }
      
      // 添加到父节点的子节点列表
      const parentNode = nodeMap.get(parentId);
      const currentNode = nodeMap.get(node.id);
      
      if (parentNode && currentNode) {
        parentNode.children.push(currentNode);
      }
    });
    
    // 返回根节点列表
    return Array.from(nodeMap.values());
  };
  
  // 扁平化节点树，根据展开状态筛选节点
  const flattenNodeTree = (nodes: Node3D[], expanded: Set<string>): Node3D[] => {
    const result: Node3D[] = [];
    
    const processNode = (node: Node3D, isVisible: boolean) => {
      // 如果是根节点或父节点已展开，则可见
      if (node.id === 'DS' || node.id === 'AB' || isVisible) {
        result.push(node);
        
        // 如果当前节点已展开，则处理其子节点
        const isExpanded = expanded.has(node.id);
        node.children.forEach(child => {
          processNode(child, isVisible && isExpanded);
        });
      }
    };
    
    // 从根节点开始处理
    const rootNodes = nodes.filter(node => node.id === 'DS' || node.id === 'AB');
    rootNodes.forEach(root => processNode(root, true));
    
    return result;
  };
  
  // 布局节点
  const layoutNodes = (nodes: Node3D[]): Node3D[] => {
    // 找到DS和AB根节点
    const dsNode = nodes.find(node => node.id === 'DS');
    const abNode = nodes.find(node => node.id === 'AB');
    
    // 设置两个图谱的中心点 - XY坐标相同，Z不同
    const centerX = 0;
    const centerY = 0;
    const knowledgeZ = -5; // 底面，从-10改为-5
    const abilityZ = 5;    // 顶面，从10改为5
    const cylinderRadius = 12; // 增加圆柱体半径，从8增加到12，为节点提供更多空间
    
    // 更新根节点位置
    if (dsNode) {
      dsNode.position.set(centerX, centerY, knowledgeZ);
    }
    
    if (abNode) {
      abNode.position.set(centerX, centerY, abilityZ);
    }
    
    // 递归布局子节点 - 在圆形平面向外布局
    const layoutChildren = (node: Node3D, startAngle: number, angleRange: number, level: number, zLevel: number) => {
      if (node.children.length === 0) return;
      
      // 计算每个子节点的角度
      const angleStep = angleRange / node.children.length;
      
      // 根据子节点数量动态调整半径增量
      const radiusMultiplier = Math.max(1.0, Math.min(1.5, node.children.length / 5)); // 子节点越多，半径越大
      
      node.children.forEach((child, index) => {
        let radius = 0;
        
        if (level === 0) {
          // 第一层子节点放在圆周边缘，带有一些随机偏移
          radius = cylinderRadius * (1 + (Math.random() * 0.2 - 0.1)); // 添加±10%的随机偏移
        } else {
          // 后续层级向外扩散，基于层级和子节点数量动态计算
          radius = cylinderRadius * (1 + 0.6 * level * radiusMultiplier);
          
          // 为同层级的节点添加随机半径偏移，避免完全对齐
          const radiusVariation = radius * 0.15; // 15%的半径变化
          radius += (Math.random() * radiusVariation - radiusVariation/2);
        }
        
        // 计算子节点角度，添加小幅随机偏移
        const angleOffset = (Math.random() * 0.3 - 0.15) * angleStep; // ±15%的角度随机偏移
        const childAngle = startAngle + index * angleStep + (angleStep / 2) + angleOffset;
        
        // 计算位置 - 在XY平面上分布，Z固定但有微小随机变化
        const x = centerX + radius * Math.cos(childAngle);
        const y = centerY + radius * Math.sin(childAngle);
        const zOffset = (Math.random() * 0.4 - 0.2); // 添加±0.2的Z轴随机偏移
        
        // 位于同一个Z平面上，但有微小偏移
        child.position.set(x, y, zLevel + zOffset);
        
        // 递归布局子节点 - 围绕当前节点，分配一小段角度
        const childAngleRange = angleStep * 0.9; // 给子节点分配稍小的角度范围
        layoutChildren(child, childAngle - childAngleRange/2, childAngleRange, level + 1, zLevel);
      });
    };
    
    // 布局知识图谱 - 在底面平面上
    if (dsNode) {
      layoutChildren(dsNode, 0, 2 * Math.PI, 0, knowledgeZ);
    }
    
    // 布局能力图谱 - 在顶面平面上
    if (abNode) {
      layoutChildren(abNode, 0, 2 * Math.PI, 0, abilityZ);
    }
    
    return nodes;
  };
  
  // 创建边
  const createEdges = (nodes: Node3D[]): Edge3D[] => {
    const edges: Edge3D[] = [];
    
    // 为每个节点创建到其父节点的边
    nodes.forEach(node => {
      if (node.id === 'DS' || node.id === 'AB') return;
      
      // 获取父节点ID
      let parentId = '';
      if ((node.id.startsWith('DS') || node.id.startsWith('AB')) && node.id.length > 2) {
        parentId = node.id.slice(0, -2);
        if (parentId === '') {
          parentId = node.id.startsWith('DS') ? 'DS' : 'AB';
        }
      }
      
      // 查找父节点
      const parentNode = nodes.find(n => n.id === parentId);
      
      if (parentNode) {
        edges.push({
          source: parentId,
          target: node.id,
          sourcePosition: parentNode.position,
          targetPosition: node.position
        });
      }
    });
    
    return edges;
  };
  
  // 更新边的位置
  const updateEdges = () => {
    setEdges3D(edges => {
      return edges.map(edge => {
        const sourceNode = nodes3D.find(node => node.id === edge.source);
        const targetNode = nodes3D.find(node => node.id === edge.target);
        
        if (sourceNode && targetNode) {
          return {
            ...edge,
            sourcePosition: sourceNode.position,
            targetPosition: targetNode.position
          };
        }
        
        return edge;
      });
    });
  };
  
  // 监听knowledgeNodes和abilityNodes变化，并更新3D节点
  useEffect(() => {
    if (loading || !knowledgeNodes.length || !abilityNodes.length) return;
    
    // 使用requestAnimationFrame防止界面卡顿
    const updateFrame = requestAnimationFrame(() => {
      try {
    // 构建节点树
    const knowledgeTree = buildNodeTree(knowledgeNodes, 'knowledge');
    const abilityTree = buildNodeTree(abilityNodes, 'ability');
    
    // 合并两个图谱的节点
    const allNodes = [...knowledgeTree, ...abilityTree];
    
        // 根据展开状态筛选节点
    const visibleNodes = flattenNodeTree(allNodes, expandedNodes);
    
    // 布局节点
    const layoutedNodes = layoutNodes(visibleNodes);
        
        console.log("节点数据更新:", layoutedNodes.length);
    
    // 设置节点
    setNodes3D(layoutedNodes);
    
    // 创建边
    const edges = createEdges(layoutedNodes);
    setEdges3D(edges);
      } catch (error) {
        console.error('节点更新时出错:', error);
      }
    });
    
    // 清理函数
    return () => cancelAnimationFrame(updateFrame);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeNodes, abilityNodes]);
  
  // 监听展开状态变化，更新节点
  useEffect(() => {
    if (knowledgeNodes.length > 0 || abilityNodes.length > 0) {
      console.log("展开状态变化，更新节点", expandedNodes);
      updateNodesAfterChange();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedNodes, knowledgeNodes, abilityNodes]);

  // 专门监听节点数据变化
  useEffect(() => {
    if (!loading && (knowledgeNodes.length > 0 || abilityNodes.length > 0)) {
      console.log("节点数据变化，更新3D视图");
      updateNodesAfterChange();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeNodes, abilityNodes, loading]);
  
  // 添加节点后强制刷新标签
  useEffect(() => {
    // 立即强制刷新
    const timer = setTimeout(() => {
      if (nodes3D.length > 0) {
        console.log("强制刷新节点标签", nodes3D.length);
        // 创建临时新数组触发更新
        setNodes3D([...nodes3D]);
      }
    }, 100); // 延迟100ms确保DOM已更新
    
    return () => clearTimeout(timer);
  }, [nodes3D.length]); // 只在节点数量变化时触发
  
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
  const showContextMenu = (event: MouseEvent, nodeId: string, position: THREE.Vector3) => {
    // 首先关闭所有现有菜单
    clearContextMenus();
    
    // 确定节点类型
    const nodeType = nodeId.startsWith('DS') ? 'knowledge' : 'ability';
    
    // 检查是否有子节点
    let hasChildren = false;
    if (nodeId === 'DS' || nodeId === 'AB') {
      // 对于根节点，查找直接子节点
      hasChildren = nodes3D.some(node => 
        node.id.startsWith(nodeId) && 
        node.id !== nodeId && 
        node.id.length <= 4
      );
    } else {
      // 对于其他节点，查找前缀匹配的子节点
      hasChildren = nodes3D.some(node => 
        node.id.startsWith(nodeId) && 
        node.id !== nodeId && 
        node.id.length === nodeId.length + 2
      );
    }
    
    // 如果是根节点（DS或AB），不允许删除
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
      
      showContextMenuItems(event, position, rootMenuItems);
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
    
    showContextMenuItems(event, position, menuItems);
  };
  
  // 显示菜单项
  const showContextMenuItems = (event: MouseEvent, position: THREE.Vector3, menuItems: any[]) => {
    // 获取鼠标位置
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    // 阻止事件冒泡和默认行为
    event.stopPropagation();
    event.preventDefault();
    
    // 创建临时菜单元素
    const menuDiv = document.createElement('div');
    menuDiv.className = 'context-menu-container';
    menuDiv.style.position = 'absolute';
    menuDiv.style.left = `${mouseX}px`;
    menuDiv.style.top = `${mouseY}px`;
    menuDiv.style.zIndex = '10000';
    menuDiv.style.backgroundColor = 'white';
    menuDiv.style.borderRadius = '8px';
    menuDiv.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    menuDiv.style.padding = '8px 0';
    menuDiv.style.minWidth = '150px';
    menuDiv.style.overflow = 'hidden';
    menuDiv.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    
    // 添加菜单淡入动画样式
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes context-menu-fade-in {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .context-menu-container {
        animation: context-menu-fade-in 0.15s ease-out forwards;
      }
    `;
    document.head.appendChild(styleElement);
    
    // 创建菜单项
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.style.padding = '8px 16px';
      menuItem.style.cursor = 'pointer';
      menuItem.style.display = 'flex';
      menuItem.style.alignItems = 'center';
      menuItem.style.transition = 'background-color 0.15s';
      menuItem.style.fontSize = '14px';
      menuItem.style.color = '#333';
      
      // 鼠标悬停效果
      menuItem.addEventListener('mouseover', () => {
        menuItem.style.backgroundColor = '#f5f5f5';
      });
      
      menuItem.addEventListener('mouseout', () => {
        menuItem.style.backgroundColor = 'transparent';
      });
      
      // 创建图标容器
      const iconContainer = document.createElement('div');
      iconContainer.className = 'context-menu-item-icon';
      iconContainer.style.width = '24px';
      iconContainer.style.height = '24px';
      iconContainer.style.marginRight = '8px';
      iconContainer.style.display = 'flex';
      iconContainer.style.alignItems = 'center';
      iconContainer.style.justifyContent = 'center';
      
      // 添加图标
      let iconSvg;
      if (item.id === 'add-child') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>`;
      } else if (item.id === 'edit') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>`;
      } else if (item.id === 'delete') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F44336" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>`;
      }
      
      iconContainer.innerHTML = iconSvg || '';
      menuItem.appendChild(iconContainer);
      
      // 添加文本
      const textSpan = document.createElement('span');
      textSpan.innerText = item.content;
      menuItem.appendChild(textSpan);
      
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止点击事件冒泡
        item.onClickFunction();
        clearContextMenus();
      });
      
      menuDiv.appendChild(menuItem);
      
      if (item.hasTrailingDivider) {
        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        divider.style.height = '1px';
        divider.style.backgroundColor = '#e5e7eb';
        divider.style.margin = '4px 0';
        menuDiv.appendChild(divider);
      }
    });
    
    // 添加到文档
    document.body.appendChild(menuDiv);
    
    // 为菜单本身添加点击事件监听器，阻止冒泡
    menuDiv.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
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
    }, 300); // 增加延迟时间从100ms到300ms
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
    const nextId = generateNextAvailableId(parentId, type);
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
    
    const nodeType = nodeId.startsWith('DS') ? 'knowledge' : 'ability';
    const nodes = nodeType === 'knowledge' ? knowledgeNodes : abilityNodes;
    
    // 查找节点
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      showToast(`找不到节点 ${nodeId}`, 'error');
      return;
    }
    
    // 设置节点类型
    setNodeType(nodeType);
    
    // 设置为编辑模式（这很重要）
    setIsEditMode(true);
    
    // 预填充节点数据 - 根据节点类型处理不同的属性
    if (nodeType === 'knowledge') {
      setNewNode({
        id: node.id,
        label: node.label,
        difficulty: node.difficulty,
        importance: node.importance,
        description: node.description || ''
      });
    } else {
      // 能力节点可能包含tag属性
      const abilityNode = node as AbilityNode;
      setNewNode({
        id: node.id,
        label: node.label,
        difficulty: node.difficulty,
        importance: node.importance,
        description: node.description || '',
        tag: abilityNode.tag || ''
      });
    }
    
    // 打开添加模态框
    setShowAddModal(true);
  };
  
  // 预览删除节点
  const previewDeleteNode = (nodeId: string) => {
    // 清除所有右键菜单
    clearContextMenus();
    
    if (!nodeId) return;
    
    // 设置要删除的节点
    setNodeToDelete(nodeId);
    
    // 打开删除确认框
    setShowDeleteModal(true);
  };
  
  // 处理节点右键点击
  const handleNodeRightClick = (nodeId: string, event: MouseEvent, position: THREE.Vector3) => {
    event.preventDefault();
    event.stopPropagation(); // 确保阻止事件冒泡
    
    // 首先清除所有现有菜单，避免多个菜单同时显示
    clearContextMenus();
    
    // 使用setTimeout延迟一下菜单显示，避免与其他事件冲突
    setTimeout(() => {
      showContextMenu(event, nodeId, position);
    }, 50);
  };
  
  if (loading) {
    return (
      <div style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e74c3c' }}>
        <div className="error-message">错误: {error}</div>
      </div>
    );
  }
  
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {loading ? (
        <div style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div>加载中...</div>
          </div>
        </div>
      ) : error ? (
        <div style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e74c3c' }}>
          <div className="error-message">错误: {error}</div>
        </div>
      ) : (
      <Canvas 
          shadows
          camera={{ position: [0, 0, 20], fov: 50 }}
          style={{ width: '100%', height: '100%', background: '#030712' }}
          onContextMenu={(e) => e.preventDefault()} // 禁用画布的默认右键菜单
        >
          <ambientLight intensity={0.4} />
          <directionalLight
            castShadow
            position={[10, 20, 15]}
            intensity={1}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          
        <SafeScene>
            {/* 渲染节点 */}
            {nodes3D.map(node => (
              <SafeNodeObject 
                key={node.id}
                node={node}
                onClick={handleNodeClick}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onRightClick={(event, position) => handleNodeRightClick(node.id, event, position)}
                isSelected={selectedNodeId === node.id}
              />
            ))}
            
            {/* 渲染边 */}
            {edges3D.map((edge, index) => (
              <SafeEdgeObject 
                key={`${edge.source}-${edge.target}-${index}`}
                source={edge.sourcePosition}
                target={edge.targetPosition}
                sourceType={nodes3D.find(n => n.id === edge.source)?.nodeType || 'knowledge'}
              />
            ))}
        </SafeScene>
      </Canvas>
      )}
      
      {/* 添加图谱说明 */}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#3a86ff', marginRight: '5px', borderRadius: '50%' }}></div>
          <span>知识图谱（底面）</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#ffd700', marginRight: '5px', borderRadius: '50%' }}></div>
          <span>能力图谱（顶面）</span>
        </div>
      </div>
      
      {/* 添加调试信息 */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '5px' }}>
        <div>节点数量: {nodes3D.length}</div>
        <div>已展开节点: {expandedNodes.size}</div>
        {selectedNodeId && <div>选中节点: {selectedNodeId}</div>}
      </div>

      {/* 控制面板放在左侧，确保它始终可见 */}
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
      
      {/* 消息提示 */}
      <div className="toast-container" style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '300px',
        zIndex: 10000,
      }}>
        {toasts.map(toast => (
          <div 
            key={toast.id}
            style={{
              marginBottom: '10px',
              padding: '15px 20px',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 'bold',
              animation: 'toast-slide-in 0.3s ease-out forwards',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
            }}
          >
            {toast.type === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )}
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
                  {isEditMode ? (
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  ) : (
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                  )}
                  {isEditMode ? (
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  ) : (
                    <line x1="5" y1="12" x2="19" y2="12"></line>
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
              ? '请修改节点信息，修改完成后点击保存按钮。' 
              : '请填写以下信息添加新节点。节点ID将根据图谱类型和父节点自动生成，您也可以选择自定义。'}
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                图谱类型 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {!isEditMode ? (
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
                      generateNextAvailableId(selectedParentId, 'knowledge');
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
                      generateNextAvailableId(selectedParentId, 'ability');
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
              ) : (
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '2px solid',
                  borderColor: nodeType === 'knowledge' ? '#3b82f6' : '#f59e0b',
                  backgroundColor: nodeType === 'knowledge' ? '#eff6ff' : '#fffbeb',
                  color: nodeType === 'knowledge' ? '#1d4ed8' : '#b45309',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    backgroundColor: nodeType === 'knowledge' ? '#3b82f6' : '#f59e0b', 
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    {nodeType === 'knowledge' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 20V10"></path>
                        <path d="M12 20V4"></path>
                        <path d="M6 20v-6"></path>
                      </svg>
                    )}
                  </div>
                  {nodeType === 'knowledge' ? '知识图谱' : '能力图谱'}
                </div>
              )}
            </div>
            
            {!isEditMode && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  父节点 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={selectedParentId}
                  onChange={(e) => handleParentChange(e.target.value)}
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
                  {(nodeType === 'knowledge' ? knowledgeNodes : abilityNodes)
                    .filter(node => node.id !== 'DS' && node.id !== 'AB') // 排除根节点，因为已经单独添加了
                    .sort((a, b) => a.id.localeCompare(b.id)) // 按ID排序
                    .map(node => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.id})
                      </option>
                    ))
                  }
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
                        onChange={(e) => handleCustomIdChange(e.target.checked)}
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
                  backgroundColor: isEditMode ? '#f3f4f6' : (customIdInput ? 'white' : '#f3f4f6')
                }}
                type="text" 
                placeholder={!isEditMode && customIdInput ? "输入节点编号" : "自动生成的编号"}
                value={newNode.id || ''}
                readOnly={isEditMode || !customIdInput}
                onChange={(e) => setNewNode(prev => ({ ...prev, id: e.target.value }))}
                onFocus={(e) => {
                  if (!isEditMode && customIdInput) e.target.style.borderColor = '#3b82f6';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
              {!isEditMode && customIdInput && (
                <p style={{ 
                  margin: '8px 0 0 0', 
                  fontSize: '0.85rem', 
                  color: '#6b7280' 
                }}>
                  自定义ID必须遵循格式：知识图谱以DS开头，能力图谱以AB开头，后跟字母或数字。
                </p>
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
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  重要性
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
                  placeholder="0.0 - 1.0"
                  value={newNode.importance || 0.5}
                  onChange={(e) => setNewNode(prev => ({ ...prev, importance: parseFloat(e.target.value) }))}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                  难度
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
                  placeholder="0.0 - 1.0"
                  value={newNode.difficulty || 0.5}
                  onChange={(e) => setNewNode(prev => ({ ...prev, difficulty: parseFloat(e.target.value) }))}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
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
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
                placeholder="输入节点描述"
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
                  placeholder="输入标签"
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
                onClick={resetAddNodeForm}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  backgroundColor: 'white',
                  color: '#4b5563',
                  fontWeight: '500',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
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
                    <>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </>
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
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  backgroundColor: 'white',
                  color: '#4b5563',
                  fontWeight: '500',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                取消
              </button>
              <button 
                onClick={deleteNode}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#ef4444',
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
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                删除节点
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Graph3D; 