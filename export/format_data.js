const fs = require('fs');
const path = require('path');

// 读取已生成的基础JSON数据
const inputPath = path.join(__dirname, './graph_data.json');
const outputPath = path.join(__dirname, './formatted_graph.json');

// 处理并格式化图谱数据
function formatGraphData() {
  try {
    // 读取原始数据
    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const knowledgeData = rawData.knowledge || [];
    const abilityData = rawData.ability || [];
    
    // 合并所有节点
    const allNodes = [...knowledgeData, ...abilityData];
    
    // 创建格式化的节点数组
    const nodes = allNodes.map(item => ({
      id: item['编号'] || item['ID'],
      name: item['Name'] || item['名称'],
      type: item['Label'] || '知识点',
      properties: {
        difficulty: parseFloat(item['Difficulty_degree'] || item['难度'] || 0),
        importance: parseFloat(item['Importance_degree'] || item['重要性'] || 0),
        description: item['Description'] || item['描述'] || ''
      }
    }));
    
    // 创建边数组
    const edges = [];
    
    // 根据节点ID构建父子关系的边
    nodes.forEach(node => {
      const nodeId = node.id;
      if (!nodeId || nodeId.length <= 2) return;
      
      // 取前面部分作为父节点ID
      let parentId;
      
      if (nodeId.length === 4) { // 例如 "DS01"
        parentId = nodeId.substring(0, 2); // "DS"
      } else if (nodeId.length === 6) { // 例如 "DS0101"
        parentId = nodeId.substring(0, 4); // "DS01"
      } else if (nodeId.length === 8) { // 例如 "DS010101"
        parentId = nodeId.substring(0, 6); // "DS0101"
      }
      
      if (parentId && nodes.some(n => n.id === parentId)) {
        edges.push({
          source: parentId,
          target: nodeId,
          type: 'parent-child',
          properties: {
            relationship: 'contains'
          }
        });
      }
    });
    
    // 创建最终的格式化数据
    const formattedData = {
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        description: "知识图谱数据，包含知识点和能力点的节点及其关系",
        exportDate: new Date().toISOString()
      }
    };
    
    // 写入文件
    fs.writeFileSync(outputPath, JSON.stringify(formattedData, null, 2), 'utf8');
    console.log(`格式化的图谱数据已保存至: ${outputPath}`);
    console.log(`总节点数: ${nodes.length}, 总边数: ${edges.length}`);
    
    return formattedData;
  } catch (error) {
    console.error('格式化图谱数据时出错:', error);
    return null;
  }
}

// 执行格式化
formatGraphData(); 