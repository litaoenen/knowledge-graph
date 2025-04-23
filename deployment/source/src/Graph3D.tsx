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
  
  // 当数据加载完成后，构建3D节点和边
  useEffect(() => {
    if (loading || knowledgeNodes.length === 0 || abilityNodes.length === 0) return;
    
    // 构建节点树
    const knowledgeTree = buildNodeTree(knowledgeNodes, 'knowledge');
    const abilityTree = buildNodeTree(abilityNodes, 'ability');
    
    // 合并两个图谱的节点
    const allNodes = [...knowledgeTree, ...abilityTree];
    
    // 根据扩展状态筛选节点
    const visibleNodes = flattenNodeTree(allNodes, expandedNodes);
    
    // 布局节点
    const layoutedNodes = layoutNodes(visibleNodes);
    
    // 设置节点
    setNodes3D(layoutedNodes);
    
    // 创建边
    const edges = createEdges(layoutedNodes);
    setEdges3D(edges);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeNodes, abilityNodes, loading]);
  
  // 根据展开状态更新节点可见性
  useEffect(() => {
    if (nodes3D.length === 0 || !knowledgeNodes.length || !abilityNodes.length) return;
    
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
        
        console.log("节点更新:", layoutedNodes.length, "展开节点:", Array.from(expandedNodes));
        
        // 设置节点
        setNodes3D(layoutedNodes);
        
        // 创建边
        const edges = createEdges(layoutedNodes);
        setEdges3D(edges);
      } catch (error) {
        console.error('节点展开时出错:', error);
      }
    });
    
    // 清理函数
    return () => cancelAnimationFrame(updateFrame);
    
  // 确保依赖数组包含所有需要的变量
  }, [expandedNodes, knowledgeNodes, abilityNodes]);
  
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
    <div style={{ width: '100%', height: '80vh', position: 'relative' }}>
      <Canvas 
        camera={{ position: [0, 0, 30], fov: 50 }}
      >
        <SafeScene>
          {/* 添加整体旋转的群组 */}
          <group rotation={[0, 0, 0]}>
            {/* 渲染节点 */}
            {nodes3D.filter(node => node.position && typeof node.position.x === 'number').map(node => (
              <SafeNodeObject 
                key={node.id}
                node={{
                  ...node,
                  isExpanded: expandedNodes.has(node.id) // 确保传递正确的展开状态
                }}
                onClick={handleNodeClick}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                isSelected={selectedNodeId === node.id}
              />
            ))}
            
            {/* 渲染边 */}
            {edges3D.filter(edge => 
              edge.sourcePosition && 
              edge.targetPosition && 
              typeof edge.sourcePosition.x === 'number' && 
              typeof edge.targetPosition.x === 'number'
            ).map(edge => (
              <SafeEdgeObject 
                key={`${edge.source}-${edge.target}`}
                edge={edge}
                isSelected={selectedNodeId === edge.source || selectedNodeId === edge.target}
              />
            ))}
            
            {/* 添加连接中心点的线 */}
            <primitive object={new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, -5),
                new THREE.Vector3(0, 0, 5)
              ]),
              new THREE.LineBasicMaterial({ color: '#999999', opacity: 0.3, transparent: true })
            )} />
          </group>
        </SafeScene>
      </Canvas>
      
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
    </div>
  );
};

export default Graph3D; 