import React, { useRef, useEffect, useState } from 'react';
import cytoscape, { NodeSingular, NodeDataDefinition, LayoutOptions } from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent'; // 更智能的布局算法
import { KnowledgeNode, readExcelFile } from './utils/excelReader';

// 注册布局引擎
cytoscape.use(coseBilkent);

interface NodeData extends NodeDataDefinition {
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
}

// 根据ID长度确定节点类型
const getNodeType = (id: string): string => {
  if (id === 'DS' || id.startsWith('DS') && id.length <= 4) return 'chapter';
  if (id.startsWith('DS') && id.length <= 6) return 'section';
  if (id.startsWith('DS') && id.length <= 8) return 'subsection';
  if (id.startsWith('DS') && id.length <= 10) return 'point';
  return 'detail';
};

// 创建边的关系
const createEdges = (nodes: KnowledgeNode[]) => {
  const edges: { data: { source: string, target: string, id: string } }[] = [];
  
  nodes.forEach(node => {
    if (node.id === 'DS') return; // 跳过根节点
    
    // 获取父节点ID
    let parentId: string;
    if (node.id.startsWith('DS') && node.id.length > 2) {
      parentId = node.id.slice(0, -2);
      // 确保parentId有效
      if (parentId === '') {
        parentId = 'DS'; // 如果截取后为空，则父节点为DS
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
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
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
        const response = await fetch('/knowledge_graph.xlsx');
        if (!response.ok) {
          throw new Error('Excel文件加载失败');
        }
        const arrayBuffer = await response.arrayBuffer();
        const data = await readExcelFile(arrayBuffer);
        if (!data || data.length === 0) {
          throw new Error('Excel文件为空或格式不正确');
        }
        setNodes(data);
      } catch (error) {
        console.error('Failed to load Excel file:', error);
        setError(error instanceof Error ? error.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };

    loadExcelData();
  }, []);

  // 初始化图谱
  useEffect(() => {
    if (!containerRef.current || loading || error || nodes.length === 0) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(node => ({
          data: { 
            ...node,
            isRoot: node.id.length <= 4,
            type: getNodeType(node.id)
          }
        })),
        ...createEdges(nodes)
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
              const type = ele.data('type');
              // 不同类型使用不同颜色
              if (type === 'chapter' || type === 'section') return '#3a86ff';
              return '#ff006e';
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
        // 获取顶层节点（没有父节点的节点）
        const topLevelNodes = cy.nodes()
          .filter(node => !parentMap[node.id()])
          .sort((a, b) => a.id().localeCompare(b.id()))
          .toArray() as cytoscape.NodeSingular[];
      
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
          endAngle: number
        ) => {
          // 获取并排序子节点
          const children = (childrenMap[node.id()] || [])
            .sort((a, b) => a.id().localeCompare(b.id()));
      
          // 计算基础半径和节点大小
          const baseRadius = 600 * (level + 1);
          
          // 计算当前节点的位置
          const angle = (startAngle + endAngle) / 2;
          const radius = baseRadius;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          
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
              
              positionNode(child, level + 1, currentAngle, childEndAngle);
              currentAngle = childEndAngle;
            });
          }
        };
      
        // 计算顶层节点的权重
        const topLevelWeights = topLevelNodes.map(node => {
          const totalChildren = calculateTotalChildren(node);
          return Math.max(1, totalChildren);
        });
      
        // 计算总权重
        const totalTopLevelWeight = topLevelWeights.reduce((sum, weight) => sum + weight, 0);
      
        // 根据权重分配顶层节点的角度
        let currentAngle = 0;
        topLevelNodes.forEach((node, index) => {
          const weight = topLevelWeights[index];
          const angleRange = 2 * Math.PI * (weight / totalTopLevelWeight);
          const endAngle = currentAngle + angleRange;
          
          positionNode(node, 0, currentAngle, endAngle);
          currentAngle = endAngle;
        });
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
  }, [nodes, loading, error]); // 移除expandedNodes依赖，避免重新渲染

  // 单独监听expandedNodes变化，只更新节点可见性而不重新渲染整个图
  useEffect(() => {
    if (cyRef.current) {
      updateNodesVisibility();
      // 更新节点的展开/收起标记
      updateExpandCollapseMarkers();
    }
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
      
      // 处理其他非根节点
      cy.nodes().filter(node => {
        const nodeId = node.id();
        return nodeId !== 'DS' && !(nodeId.startsWith('DS') && nodeId.length <= 4);
      }).forEach(node => {
        const nodeId = node.id();
        let parentId = '';
        
        // 计算父节点ID
        if (nodeId.startsWith('DS')) {
          parentId = nodeId.slice(0, -2);
          if (parentId === '') {
            parentId = 'DS';
          }
        }
        
        const isParentExpanded = expandedNodes.has(parentId);
        
        // 递归检查上层节点是否都展开
        let shouldBeVisible = isParentExpanded;
        let currentParentId = parentId;
        
        while (currentParentId !== 'DS' && currentParentId.length > 4 && shouldBeVisible) {
          const grandParentId = currentParentId.slice(0, -2);
          shouldBeVisible = expandedNodes.has(grandParentId);
          currentParentId = grandParentId;
        }
        
        // 还需检查DS节点是否展开（对于深层级节点）
        if (shouldBeVisible && !expandedNodes.has('DS')) {
          shouldBeVisible = false;
        }
        
        node.style('opacity', shouldBeVisible ? 1 : 0);
        
        // 使用setTimeout确保CSS过渡动画完成后再更改display属性
        setTimeout(() => {
          if (cyRef.current) {
            node.style('display', shouldBeVisible ? 'element' : 'none');
          }
        }, 300);
      });
      
      // 确保DS根节点总是可见
      cy.getElementById('DS').style('display', 'element').style('opacity', 1);
      
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
      
      // 设置提示框内容
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
