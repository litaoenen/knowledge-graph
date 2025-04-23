# 知识图谱数据格式说明

本目录包含知识图谱的数据导出文件，可用于其他系统（如能力诊断系统）的数据导入。

## 文件说明

- `knowledge_graph.json` - 标准格式的知识图谱数据，包含节点和关系
- `raw_graph_data.json` - 原始Excel数据导出的JSON格式

## 数据格式

### 标准格式 (knowledge_graph.json)

这是一个符合标准图数据结构的JSON文件，包含以下主要部分：

```json
{
  "nodes": [ ... ],  // 节点数组
  "edges": [ ... ],  // 边/关系数组
  "metadata": { ... } // 元数据
}
```

#### 节点格式

每个节点包含以下字段：
- `id`: 节点唯一标识符，例如 "DS01"
- `name`: 节点名称
- `type`: 节点类型，如"章节"、"一级知识点"等
- `properties`: 节点属性对象
  - `difficulty`: 难度值 (0-1)
  - `importance`: 重要性值 (0-1)
  - `description`: 描述文本

#### 边/关系格式

每条边包含以下字段：
- `source`: 源节点ID
- `target`: 目标节点ID
- `type`: 关系类型，如"parent-child"
- `properties`: 关系属性对象
  - `relationship`: 具体关系描述

### 节点ID规则说明

节点ID遵循以下规则：
- 两字符前缀表示根节点，如"DS"表示数据结构
- 四字符ID表示一级节点，如"DS01"表示数据结构的第一章
- 六字符ID表示二级节点，如"DS0101"表示第一章第一节
- 八字符ID表示三级节点，如"DS010101"表示更深层次的知识点

## 使用方法

### 导入到能力诊断系统

1. 将`knowledge_graph.json`文件作为数据源
2. 根据系统API要求进行格式转换
3. 导入系统中使用

### 数据处理示例

```javascript
// 读取JSON数据
const graphData = require('./knowledge_graph.json');

// 获取所有节点
const allNodes = graphData.nodes;

// 获取所有关系
const allEdges = graphData.edges;

// 获取特定类型的节点（如一级知识点）
const firstLevelNodes = allNodes.filter(node => node.type === '一级知识点');

// 获取特定节点的子节点
function getChildNodes(nodeId) {
  const childEdges = allEdges.filter(edge => edge.source === nodeId);
  return childEdges.map(edge => {
    const childNode = allNodes.find(node => node.id === edge.target);
    return childNode;
  });
}
```

## 数据统计

- 总节点数：根据元数据中的totalNodes字段获取
- 总关系数：根据元数据中的totalEdges字段获取
 