# 知识图谱与能力图谱可视化系统

这是一个基于React的知识图谱与能力图谱可视化系统，提供了2D和3D两种视图方式来展示知识点和能力点之间的关系。

## 主要功能

- **2D视图**：使用Cytoscape.js实现的平面图谱展示
  - 支持节点展开/收起
  - 支持节点拖拽
  - 支持节点搜索
  - 支持节点细节查看
  - 支持知识点与能力点的映射关系展示

- **3D视图**：使用Three.js实现的立体图谱展示
  - 知识图谱和能力图谱分别位于不同平面
  - 节点展开/收起动画效果
  - 节点拖拽功能
  - 支持知识点与能力点的映射关系展示（通过特殊的连接线）

- **节点管理**
  - 添加新节点
  - 编辑现有节点
  - 删除节点
  - 设置节点属性（难度、重要性等）

- **数据导入导出**
  - 支持从Excel文件导入节点数据
  - 支持从Excel文件导入知识点与能力点的映射关系

## 技术栈

- React
- TypeScript
- Cytoscape.js (2D图谱)
- Three.js (3D图谱)
- React Three Fiber (@react-three/fiber)
- xlsx.js (Excel文件处理)

## 如何使用

1. 安装依赖：
   ```
   npm install
   ```

2. 启动开发服务器：
   ```
   npm start
   ```

3. 构建生产版本：
   ```
   npm run build
   ```

## 数据格式

系统使用Excel文件作为数据源，需要准备以下文件：

- `knowledge_graph.xlsx`：知识点数据
- `ability_graph.xlsx`：能力点数据
- `knowledge_ability_mapping.xlsx`：知识点与能力点的映射关系

将这些文件放置在项目的`public`目录下，系统将自动加载。

## 版本历史

当前版本：v1.5.0

查看[VERSION_HISTORY.md](./VERSION_HISTORY.md)文件了解详细的版本更新记录。
