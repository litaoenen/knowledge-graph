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
    
    edges.push({ 
      data: { 
        source: parentId, 
        target: node.id,
        id: `${parentId}-${node.id}`
      } 
    });
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
`;

const Graph = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [abilityNodes, setAbilityNodes] = useState<AbilityNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
      <div ref={containerRef} style={styles.container} />
    </>
  );
};

export default Graph;
