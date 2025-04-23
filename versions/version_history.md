# 版本历史记录

## v1.4.0 (2023-03-30)
- 修复功能和体验优化:
  - 修复了3D视图中右键菜单"修改节点"功能的问题
  - 搜索功能改进，优化了节点路径展开逻辑
  - 3D视图右键菜单样式优化，与2D视图保持一致
- 文件结构：与之前版本相同，但代码有所更新
  ```
  v1.4.0/
  ├── src/                    # 源代码文件
  ├── public/                 # 公共资源文件
  ├── package.json           # 项目依赖配置
  ├── tsconfig.json         # TypeScript配置
  └── README.md            # 项目说明文档
  ```

## v1.3.0 (2025-03-30)
- 恢复了图谱功能
- 修复了部分错误
- 优化了用户体验

## v1.1.0 (2024-03-29)
- 节点添加功能改进：
  - 允许用户选择节点添加的位置（通过拖放或点击指定位置）
  - 提供节点自动布局选项
  - 确保2D视图和3D视图同步
- 文件结构：与v1.0.0相同，但代码有所更新
  ```
  v1.1.0/
  ├── src/                    # 源代码文件
  ├── public/                 # 公共资源文件
  ├── package.json           # 项目依赖配置
  ├── tsconfig.json         # TypeScript配置
  └── README.md            # 项目说明文档
  ```

## v1.0.0 (2024-03-28)
- 初始版本备份
- 完整功能：
  - 基本的知识图谱和能力图谱可视化
  - 节点的添加、删除和编辑功能
  - 节点的展开/收起功能
  - 节点的拖拽功能
  - 节点提示框功能
  - 节点的自动布局功能
- 文件结构：
  ```
  v1.0.0/
  ├── src/                    # 源代码文件
  ├── public/                 # 公共资源文件
  ├── package.json           # 项目依赖配置
  ├── tsconfig.json         # TypeScript配置
  └── README.md            # 项目说明文档
  ```

## 如何使用版本备份

1. 如需回滚到特定版本，只需将对应版本文件夹中的文件复制回项目根目录：
```bash
# 例如回滚到v1.0.0版本
xcopy /E /Y versions\v1.0.0\* .
```

2. 创建新的版本备份：
```bash
# 1. 创建新版本文件夹
mkdir versions\v1.x.x

# 2. 复制当前代码到新版本文件夹
robocopy src versions\v1.x.x\src /E
robocopy public versions\v1.x.x\public /E
copy package.json versions\v1.x.x\
copy tsconfig.json versions\v1.x.x\
copy README.md versions\v1.x.x\

# 3. 更新version_history.md文件，添加新版本的说明
```

## 版本命名规则

- 主版本号：重大更新，可能包含破坏性变更
- 次版本号：新功能添加，但保持向后兼容
- 修订号：bug修复和小改动

例如：v1.0.0 -> v1.1.0（添加新功能）-> v1.1.1（修复bug）-> v2.0.0（重大更新）
