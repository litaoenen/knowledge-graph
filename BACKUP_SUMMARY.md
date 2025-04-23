# 知识图谱项目备份总结

## 备份概览

本项目目前包含以下备份：

### 完整项目备份

| 日期 | 路径 | 版本 | 主要功能 |
|------|------|------|---------|
| 2024-03-28 | `versions/complete_backup_2024-03-28/` | v1.2 | 父节点选择功能 |
| 2024-03-26 | `versions/complete_backup_2024-03-26/` | v1.1 | 可拖拽节点 |

### 版本功能备份

| 版本 | 日期 | 路径 | 主要功能 |
|------|------|------|---------|
| v1.2 | 2024-03-28 | `versions/v1.2_2024-03-28_parent-select/` | 父节点选择功能 |
| v1.1 | 2024-03-25 | `versions/v1.1_2024-03-25-dragable/` | 可拖拽节点 |
| v1.0 | 2024-03-25 | `versions/v1.0_2024-03-25/` | 初始基础功能 |

## 版本文档

项目版本和备份管理通过以下文件进行记录：

- **VERSION_HISTORY.md**: 记录所有版本历史和变更说明
- **VERSION_MANAGEMENT.md**: 描述版本管理规则和流程
- **COMPLETE_BACKUP_HISTORY.md**: 记录完整备份历史
- **BACKUP_SUMMARY.md**: 当前文件，提供所有备份的概览

## 备份内容

### 完整备份包含：

- `src/`: 所有源代码文件
- `public/`: 所有静态资源和数据文件
- `package.json`: 依赖管理文件
- `tsconfig.json`: TypeScript配置
- `.gitignore`: Git忽略文件
- `README.md`: 项目说明

### 版本功能备份通常包含：

- 与特定功能相关的源代码文件
- 该版本的README和相关文档

## 恢复指南

### 恢复完整备份

```powershell
# 恢复整个项目
Copy-Item "versions/complete_backup_YYYY-MM-DD/*" -Destination "./" -Recurse -Force

# 恢复特定目录
Copy-Item "versions/complete_backup_YYYY-MM-DD/src/*" -Destination "./src/" -Recurse -Force
```

### 恢复特定功能

```powershell
# 恢复特定功能的文件
Copy-Item "versions/vX.Y_YYYY-MM-DD_feature-name/src/File.tsx" -Destination "./src/" -Force
``` 