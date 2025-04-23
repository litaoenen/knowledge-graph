# 知识图谱 完整备份 (2024-03-28)

## 备份说明

这是知识图谱项目的完整备份，包含所有源代码、资源文件和配置文件。此备份在实现父节点选择功能后创建，代表了v1.2版本的完整项目状态。

## 版本特性

此备份包含的主要功能和特性：

1. **基础图谱功能**：
   - 2D/3D知识图谱和能力图谱展示
   - 节点展开/折叠功能
   - 节点详情弹窗

2. **交互增强**：
   - 节点拖拽功能
   - 图谱缩放和平移

3. **节点管理功能**：
   - 添加节点（带父节点选择和ID自动生成）
   - 删除节点（支持子节点保留和重连）
   - 现代化的UI设计和交互体验

## 目录结构

- `src/`: 源代码目录
  - `Graph.tsx`: 2D图谱核心实现
  - `Graph3D.tsx`: 3D图谱实现
  - `App.tsx`: 应用入口和路由
  - `utils/`: 工具函数目录
  - `types/`: 类型定义目录
  - `styles/`: 样式文件目录
  - `components/`: 组件目录
- `public/`: 静态资源目录
  - `ability_graph.xlsx`: 能力图谱数据
  - `knowledge_graph.xlsx`: 知识图谱数据
- `package.json`: 依赖管理
- `tsconfig.json`: TypeScript配置

## 恢复说明

如需从此备份恢复项目，可使用以下命令：

```powershell
# 将整个备份复制到工作目录
Copy-Item "versions/complete_backup_2024-03-28/*" -Destination "./" -Recurse -Force
```

## 关联版本

- 版本: v1.2
- 功能: 父节点选择功能
- 日期: 2024-03-28

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
