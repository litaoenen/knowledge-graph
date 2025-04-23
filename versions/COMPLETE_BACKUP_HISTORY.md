# 知识图谱项目完整备份历史

本文件记录了所有完整备份的历史信息，包括时间、目录和主要变更内容。

## 完整备份 (2024-03-28)

- **备份目录**: `versions/complete_backup_2024-03-28/`
- **对应版本**: v1.2
- **主要功能**: 
  - 父节点选择功能
  - 节点ID自动生成
  - 删除节点后子节点保留和重连
  - 现代化UI界面改进
- **备份内容**: 完整项目文件，包含所有源代码、配置和资源文件

## 完整备份 (2024-03-26)

- **备份目录**: `versions/complete_backup_2024-03-26/`
- **对应版本**: v1.1
- **主要功能**: 
  - 基础知识图谱和能力图谱功能
  - 节点展开/折叠功能
  - 节点拖拽功能
- **备份内容**: 完整项目文件，包含所有源代码、配置和资源文件

## 恢复说明

要从完整备份中恢复项目，请使用以下命令：

```powershell
# 恢复完整项目
Copy-Item "versions/{备份目录}/*" -Destination "./" -Recurse -Force

# 只恢复特定目录
Copy-Item "versions/{备份目录}/src/*" -Destination "./src/" -Recurse -Force
```

## 备份流程

创建完整备份的标准流程：

1. 创建新的备份目录: `versions/complete_backup_YYYY-MM-DD/`
2. 复制所有源代码: `robocopy "src" "versions/complete_backup_YYYY-MM-DD/src" /E`
3. 复制所有静态资源: `robocopy "public" "versions/complete_backup_YYYY-MM-DD/public" /E`
4. 复制配置文件: `Copy-Item "package.json", "tsconfig.json", ".gitignore" -Destination "versions/complete_backup_YYYY-MM-DD/"`
5. 创建README.md文件，详细记录备份内容和项目状态
6. 更新版本历史记录文件 