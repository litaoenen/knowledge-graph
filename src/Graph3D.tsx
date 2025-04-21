import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { KnowledgeNode, AbilityNode, readExcelFile, readAbilityExcelFile, KnowledgeAbilityMapping, readMappingExcelFile } from './utils/excelReader';
import { useGraphInteractions } from './hooks/useGraphInteractions';
import { useGraph3DInteractions, Node3D, Edge3D } from './hooks/useGraph3DInteractions';

// 导入安全组件
import SafeNodeObject from './components/SafeNodeObject';
import SafeEdgeObject from './components/SafeEdgeObject';
import SafeScene from './components/SafeScene';

// 主图谱组件
const Graph3D: React.FC = () => {
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [abilityNodes, setAbilityNodes] = useState<AbilityNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<KnowledgeAbilityMapping[]>([]);
  
  // 使用自定义Hook替换原有的状态和方法
  const {
    showAddModal,
    setShowAddModal,
    showDeleteModal,
    setShowDeleteModal,
    nodeType,
    setNodeType,
    newNode,
    setNewNode,
    nodeToDelete,
    setNodeToDelete,
    isEditMode,
    setIsEditMode,
    selectedParentId,
    setSelectedParentId,
    customIdInput,
    setCustomIdInput,
    nextAvailableId,
    setNextAvailableId,
    toasts,
    setToasts,
    showToast,
    resetAddNodeForm,
    generateNextAvailableId
  } = useGraphInteractions();
  
  // 使用3D交互自定义Hook
  const {
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
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    
    // 方法
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
  } = useGraph3DInteractions();
  
  // 打开添加节点模态框
  const openAddNodeModal = () => {
    setShowAddModal(true);
    // 默认生成下一个可用ID
    generateNextAvailableId('', nodeType, knowledgeNodes, abilityNodes);
  };
  
  // 处理父节点选择变化
  const handleParentChange = (parentId: string) => {
    setSelectedParentId(parentId);
    generateNextAvailableId(parentId, nodeType, knowledgeNodes, abilityNodes);
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
    
    // 关闭添加节点模态框
    resetAddNodeForm();
    
    // 更新图形
    updateNodesAfterChange();
  };
  
  // 删除节点
  const deleteNode = () => {
    if (!nodeToDelete) {
      showToast('请选择要删除的节点', 'error');
      return;
    }
    
    try {
      if (nodeToDelete.startsWith('DS')) {
        // 检查是否有子节点
        const hasChildren = knowledgeNodes.some(node => 
          node.id !== nodeToDelete && node.id.startsWith(nodeToDelete)
        );
        
        if (hasChildren) {
          showToast('无法删除有子节点的节点，请先删除所有子节点', 'error');
          return;
        }
        
        // 删除节点
        setKnowledgeNodes(prev => prev.filter(node => node.id !== nodeToDelete));
        showToast(`成功删除知识节点: ${nodeToDelete}`, 'success');
      } else if (nodeToDelete.startsWith('AB')) {
        // 检查是否有子节点
        const hasChildren = abilityNodes.some(node => 
          node.id !== nodeToDelete && node.id.startsWith(nodeToDelete)
        );
        
        if (hasChildren) {
          showToast('无法删除有子节点的节点，请先删除所有子节点', 'error');
          return;
        }
        
        // 删除节点
        setAbilityNodes(prev => prev.filter(node => node.id !== nodeToDelete));
        showToast(`成功删除能力节点: ${nodeToDelete}`, 'success');
      }
      
      // 关闭删除模态框
      setShowDeleteModal(false);
      setNodeToDelete('');
      
      // 更新图形
      updateNodesAfterChange();
    } catch (error) {
      console.error('删除节点时出错:', error);
      showToast('删除节点时出错，请重试', 'error');
    }
  };
  
  // 获取节点类型
  const getNodeType = (id: string): 'chapter' | 'section' | 'subsection' | 'point' | 'detail' => {
    const length = id.length;
    if (length <= 2) return 'chapter';
    if (length <= 4) return 'section';
    if (length <= 6) return 'subsection';
    if (length <= 8) return 'point';
    return 'detail';
  };
  
  // 更新节点数据后刷新图形
  const updateNodesAfterChange = () => {
    try {
      // 重新构建节点树
      const knowledgeTree = buildNodeTree(knowledgeNodes, 'knowledge');
      const abilityTree = buildNodeTree(abilityNodes, 'ability');
      
      // 合并知识树和能力树
      const allNodes = [...knowledgeTree, ...abilityTree];
      
      // 应用位置布局
      const positionedNodes = layoutNodes(allNodes);
      
      // 扁平化节点树并应用展开状态
      const visibleNodes = flattenNodeTree(positionedNodes, expandedNodes);
      
      // 更新状态
      setNodes3D(visibleNodes);
      
      // 创建节点间的连接边
      const edges = createEdges(visibleNodes);
      setEdges3D(edges);
      
    } catch (error) {
      console.error('更新节点图形时出错:', error);
      showToast('更新图形失败', 'error');
    }
  };
  
  // 加载Excel数据
  const loadExcelData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 从本地文件加载节点数据
      const knowledgeBuffer = await fetch('/data/knowledge.xlsx').then(res => res.arrayBuffer());
      const abilityBuffer = await fetch('/data/ability.xlsx').then(res => res.arrayBuffer());
      const mappingBuffer = await fetch('/data/mapping.xlsx').then(res => res.arrayBuffer());
      
      // 解析Excel数据
      const knowledgeData = await readExcelFile(knowledgeBuffer);
      const abilityData = await readAbilityExcelFile(abilityBuffer);
      const mappingData = await readMappingExcelFile(mappingBuffer);
      
      // 更新状态
      setKnowledgeNodes(knowledgeData);
      setAbilityNodes(abilityData);
      setMappings(mappingData);
      
      console.log(`加载了 ${knowledgeData.length} 个知识节点`);
      console.log(`加载了 ${abilityData.length} 个能力节点`);
      console.log(`加载了 ${mappingData.length} 个关联关系`);
      
      // 构建3D节点结构
      const knowledgeTree = buildNodeTree(knowledgeData, 'knowledge');
      const abilityTree = buildNodeTree(abilityData, 'ability');
      
      // 合并两个树
      const allNodes = [...knowledgeTree, ...abilityTree];
      
      // 应用位置布局
      const positionedNodes = layoutNodes(allNodes);
      
      // 根据展开状态过滤可见节点
      const visibleNodes = flattenNodeTree(positionedNodes, expandedNodes);
      
      // 更新状态
      setNodes3D(visibleNodes);
      
      // 创建节点间的连接边
      const edges = createEdges(visibleNodes);
      setEdges3D(edges);
      
      setLoading(false);
    } catch (error) {
      console.error('加载数据时出错:', error);
      setError('加载数据失败，请刷新页面重试');
      setLoading(false);
    }
  };
  
  // 构建节点树
  const buildNodeTree = (nodes: (KnowledgeNode | AbilityNode)[], nodeType: 'knowledge' | 'ability'): Node3D[] => {
    try {
      // 创建一个字典，用于快速查找节点
      const nodeMap: Record<string, Node3D> = {};
      
      // 首先创建所有节点
      nodes.forEach(node => {
        const type = getNodeType(node.id);
        const color = nodeType === 'knowledge' 
          ? '#4169E1'  // 知识节点蓝色
          : '#FF6347'; // 能力节点红色
          
        // 节点半径基于类型和重要性
        let radius = 1;
        switch (type) {
          case 'chapter':
            radius = 2.5 + (node.importance || 0.5) * 2;
            break;
          case 'section':
            radius = 2 + (node.importance || 0.5) * 1.5;
            break;
          case 'subsection':
            radius = 1.5 + (node.importance || 0.5) * 1;
            break;
          case 'point':
            radius = 1 + (node.importance || 0.5) * 0.8;
            break;
          case 'detail':
            radius = 0.8 + (node.importance || 0.5) * 0.5;
            break;
        }
        
        nodeMap[node.id] = {
          id: node.id,
          label: node.label,
          type,
          nodeType,
          difficulty: node.difficulty || 0.5,
          importance: node.importance || 0.5,
          description: node.description,
          tag: 'tag' in node ? node.tag : undefined,
          position: new THREE.Vector3(0, 0, nodeType === 'knowledge' ? -5 : 5), // 初始位置，会在layoutNodes中计算真实位置
          color,
          radius,
          children: [],
          isExpanded: expandedNodes.has(node.id)
        };
      });
      
      // 构建树结构
      const roots: Node3D[] = [];
      
      // 处理知识树根节点
      if (nodeType === 'knowledge') {
        if (nodeMap['DS']) {
          roots.push(nodeMap['DS']);
        } else {
          // 如果没有DS根节点，创建一个
          const dsRoot: Node3D = {
            id: 'DS',
            label: '知识图谱',
            type: 'chapter',
            nodeType: 'knowledge',
            difficulty: 0.5,
            importance: 1,
            position: new THREE.Vector3(0, 0, -5),
            color: '#4169E1',
            radius: 4,
            children: [],
            isExpanded: expandedNodes.has('DS')
          };
          nodeMap['DS'] = dsRoot;
          roots.push(dsRoot);
        }
      } 
      // 处理能力树根节点
      else {
        if (nodeMap['AB']) {
          roots.push(nodeMap['AB']);
        } else {
          // 如果没有AB根节点，创建一个
          const abRoot: Node3D = {
            id: 'AB',
            label: '能力图谱',
            type: 'chapter',
            nodeType: 'ability',
            difficulty: 0.5,
            importance: 1,
            position: new THREE.Vector3(0, 0, 5),
            color: '#FF6347',
            radius: 4,
            children: [],
            isExpanded: expandedNodes.has('AB')
          };
          nodeMap['AB'] = abRoot;
          roots.push(abRoot);
        }
      }
      
      // 关联子节点
      Object.values(nodeMap).forEach(node => {
        if (node.id === 'DS' || node.id === 'AB') return; // 跳过根节点
        
        const parentId = node.id.slice(0, -2);
        let realParentId = parentId;
        
        // 处理没有中间节点的情况
        if (parentId.length < 2) {
          realParentId = nodeType === 'knowledge' ? 'DS' : 'AB';
        } else if (!nodeMap[parentId]) {
          // 向上查找有效的父节点
          let testId = parentId;
          while (testId.length >= 2) {
            if (nodeMap[testId]) {
              realParentId = testId;
              break;
            }
            testId = testId.slice(0, -2);
          }
          
          if (testId.length < 2) {
            realParentId = nodeType === 'knowledge' ? 'DS' : 'AB';
          }
        }
        
        // 添加到父节点的子节点列表
        if (nodeMap[realParentId]) {
          nodeMap[realParentId].children.push(node);
        } else {
          console.warn(`找不到节点 ${node.id} 的父节点 ${realParentId}`);
        }
      });
      
      return roots;
    } catch (error) {
      console.error('构建节点树时出错:', error);
      showToast('构建节点树失败', 'error');
      return [];
    }
  };
  
  // 扁平化节点树，根据展开状态返回可见节点
  const flattenNodeTree = (nodes: Node3D[], expanded: Set<string>): Node3D[] => {
    const result: Node3D[] = [];
    
    const processNode = (node: Node3D, isVisible: boolean) => {
      // 复制节点并设置可见性
      const nodeWithVisibility = {
        ...node,
        isExpanded: expanded.has(node.id)
      };
      
      if (isVisible) {
        result.push(nodeWithVisibility);
      }
      
      // 如果节点已展开，则处理其子节点
      if (expanded.has(node.id)) {
        node.children.forEach(child => {
          processNode(child, isVisible);
        });
      }
    };
    
    // 从根节点开始处理
    nodes.forEach(rootNode => {
      processNode(rootNode, true);
    });
    
    return result;
  };
  
  // 布局节点位置
  const layoutNodes = (nodes: Node3D[]): Node3D[] => {
    try {
      // 复制节点以避免修改原始数据
      const newNodes = [...nodes].map(node => ({...node}));
      
      // 对于知识树和能力树分别设置在z轴的不同位置
      newNodes.forEach(rootNode => {
        const zOffset = rootNode.nodeType === 'knowledge' ? -5 : 5;
        rootNode.position = new THREE.Vector3(0, 0, zOffset);
        
        // 使用极坐标布局子节点
        const levelSpacing = 6;  // 层级间的径向距离
        const startAngle = 0;    // 开始角度
        const angleRange = Math.PI * 2; // 角度范围
        
        layoutChildren(rootNode, startAngle, angleRange, 1, zOffset);
      });
      
      return newNodes;
      
      // 递归布局子节点
      function layoutChildren(node: Node3D, startAngle: number, angleRange: number, level: number, zLevel: number) {
        const children = node.children;
        if (children.length === 0) return;
        
        // 计算每个子节点的角度间隔
        const angleStep = angleRange / children.length;
        
        // 计算半径 (距离父节点的距离)
        const radius = levelSpacing * Math.sqrt(level);
        
        // 布局每个子节点
        children.forEach((child, index) => {
          // 计算角度
          const angle = startAngle + index * angleStep;
          
          // 计算位置
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          // 设置位置 (相对于父节点)
          child.position = new THREE.Vector3(
            node.position.x + x,
            node.position.y + y,
            zLevel + (level * 0.05) // 略微调整z坐标，使不同层级的节点在视觉上有区分
          );
          
          // 递归布局子节点的子节点
          layoutChildren(child, angle - angleStep / 2, angleStep, level + 1, zLevel);
        });
      }
    } catch (error) {
      console.error('布局节点位置时出错:', error);
      showToast('布局计算失败', 'error');
      return nodes;
    }
  };
  
  // 创建节点间的连接边
  const createEdges = (nodes: Node3D[]): Edge3D[] => {
    try {
      const edges: Edge3D[] = [];
      
      // 创建父子节点之间的边
      nodes.forEach(node => {
        node.children.forEach(child => {
          // 检查子节点是否在可见节点列表中
          const childVisible = nodes.some(n => n.id === child.id);
          
          if (childVisible) {
            edges.push({
              source: node.id,
              target: child.id,
              sourcePosition: node.position.clone(),
              targetPosition: child.position.clone()
            });
          }
        });
      });
      
      // 添加知识-能力映射关系的边
      if (mappings && mappings.length > 0) {
        mappings.forEach(mapping => {
          const knowledgeNode = nodes.find(n => n.id === mapping.knowledgeId);
          const abilityNode = nodes.find(n => n.id === mapping.abilityId);
          
          if (knowledgeNode && abilityNode) {
            edges.push({
              source: knowledgeNode.id,
              target: abilityNode.id,
              sourcePosition: knowledgeNode.position.clone(),
              targetPosition: abilityNode.position.clone()
            });
          }
        });
      }
      
      return edges;
    } catch (error) {
      console.error('创建边时出错:', error);
      showToast('创建节点连接失败', 'error');
      return [];
    }
  };
  
  // 处理鼠标点击事件，用于清除上下文菜单
  const handleCanvasClick = () => {
    clearContextMenus();
  };
  
  // 初始加载数据
  useEffect(() => {
    loadExcelData();
  }, []);
  
  // 当展开状态变化时更新节点可见性
  useEffect(() => {
    if (nodes3D.length > 0) {
      updateNodesAfterChange();
    }
  }, [expandedNodes]);
  
  // 渲染3D场景
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* 3D 场景 */}
      <Canvas
        camera={{ position: [0, 0, 25], fov: 75 }}
        onClick={handleCanvasClick}
        style={{ background: '#030A1C' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
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
              onRightClick={(event, position) => handleNodeRightClick(event, node.id, position)}
              isSelected={selectedNodeId === node.id}
            />
          ))}
          
          {/* 渲染连接边 */}
          {edges3D.map((edge, index) => (
            <SafeEdgeObject
              key={`${edge.source}-${edge.target}-${index}`}
              source={edge.sourcePosition}
              target={edge.targetPosition}
              color="#FFFFFF"
              opacity={0.4}
            />
          ))}
        </SafeScene>
      </Canvas>
      
      {/* 加载状态 */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '20px',
          borderRadius: '10px',
          color: 'white',
          zIndex: 100
        }}>
          <p>加载中，请稍候...</p>
        </div>
      )}
      
      {/* 错误信息 */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 0, 0, 0.7)',
          padding: '20px',
          borderRadius: '10px',
          color: 'white',
          zIndex: 100
        }}>
          <p>{error}</p>
        </div>
      )}
      
      {/* 上下文菜单 */}
      {contextMenu.show && (
        <div
          style={{
            position: 'absolute',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            background: 'white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            borderRadius: '4px',
            padding: '5px 0',
            zIndex: 1000
          }}
        >
          {contextMenu.items.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                item.onClick();
                clearContextMenus();
              }}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                borderBottom: index < contextMenu.items.length - 1 ? '1px solid #eee' : 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.icon && <span style={{ marginRight: '8px' }}>{item.icon}</span>}
              {item.label}
            </div>
          ))}
        </div>
      )}
      
      {/* 提示消息 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: toast.type === 'success' ? 'rgba(0, 128, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              marginBottom: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              minWidth: '200px',
              maxWidth: '400px',
              textAlign: 'center'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      
      {/* 搜索框 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          width: '300px'
        }}
      >
        <input
          type="text"
          placeholder="搜索节点 (ID或名称)"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e, knowledgeNodes, abilityNodes)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        />
        
        {searchResults.length > 0 && (
          <div
            style={{
              background: 'white',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              borderRadius: '5px',
              marginTop: '5px',
              maxHeight: '300px',
              overflow: 'auto'
            }}
          >
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleSearchResultClick(result.id)}
                style={{
                  padding: '10px',
                  borderBottom: index < searchResults.length - 1 ? '1px solid #eee' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{result.label}</div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>{result.id}</div>
                </div>
                <div
                  style={{
                    color: 'white',
                    background: result.nodeType === 'knowledge' ? '#4169E1' : '#FF6347',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.8em',
                    height: 'fit-content',
                    alignSelf: 'center'
                  }}
                >
                  {result.nodeType === 'knowledge' ? '知识' : '能力'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 添加节点按钮 */}
      <button
        onClick={openAddNodeModal}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          padding: '10px 20px',
          background: '#4169E1',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}
      >
        添加节点
      </button>
    </div>
  );
};

export default Graph3D; 