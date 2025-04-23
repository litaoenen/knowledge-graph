# 开发辅助脚本

本目录包含用于辅助知识图谱应用开发的各种实用脚本。

## 控制台日志清理工具 (clean-logs.js)

### 概述

`clean-logs.js` 是一个用于自动扫描和清理项目中 `console.log` 语句的工具。该工具可以帮助开发团队在发布前移除调试日志，提高应用性能并保持代码的专业性。

### 功能特点

- 递归扫描指定目录中的JavaScript/TypeScript文件
- 支持多种清理模式（完全移除或转换为注释）
- 支持排除特定文件和目录
- 支持基于内容的过滤（只清理包含特定文本的日志）
- 提供模拟运行模式，可在不实际修改文件的情况下预览结果
- 生成详细的扫描统计信息

### 使用方法

1. **准备工作**

   确保Node.js环境已安装，然后进入项目根目录。

2. **运行扫描（模拟模式）**

   ```bash
   node scripts/clean-logs.js
   ```

   默认情况下，脚本会以模拟(dry run)模式运行，只会报告哪些文件包含控制台日志，以及将会进行的修改，但不会实际修改文件。

3. **执行实际清理**

   打开脚本文件 `scripts/clean-logs.js`，找到配置部分，将 `dryRun` 设置为 `false`：

   ```js
   const CONFIG = {
     // ... 其他配置 ...
     dryRun: false,  // 修改为false执行实际清理
     // ... 其他配置 ...
   };
   ```

   然后再次运行脚本：

   ```bash
   node scripts/clean-logs.js
   ```

### 配置选项

脚本开头的 `CONFIG` 对象提供了多种配置选项：

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|-------|------|
| `targetDirs` | 数组 | `['src']` | 要扫描的目录 |
| `fileExtensions` | 数组 | `['.js', '.jsx', '.ts', '.tsx']` | 要处理的文件类型 |
| `ignoreDirs` | 数组 | `['node_modules', 'build', 'dist', '.git']` | 要排除的目录 |
| `preserveLogsIn` | 数组 | `['src/reportWebVitals.ts']` | 保留日志的文件列表（相对路径） |
| `consolePattern` | 正则 | `/console\.(log\|debug\|info)/` | 匹配控制台方法的模式 |
| `dryRun` | 布尔 | `true` | 是否为模拟模式 |
| `reportOnly` | 布尔 | `false` | 是否仅报告不进行替换 |
| `replaceWithComment` | 布尔 | `true` | 是否替换为注释而非删除 |
| `filterString` | 字符串 | `null` | 过滤字符串，null表示处理所有日志 |

### 实用配置示例

**只清理包含"节点"的日志**

```js
filterString: '节点'  // 只会清理包含"节点"的日志
```

**完全删除日志而不是注释掉**

```js
replaceWithComment: false
```

**只清理特定目录**

```js
targetDirs: ['src/components', 'src/hooks']
```

### 最佳实践

1. **分阶段清理**：
   - 先清理UI组件中的日志
   - 然后清理业务逻辑中的日志
   - 最后清理工具函数中的日志

2. **保留有价值的日志**：
   - 将有价值的调试日志修改为条件式日志
   - 例如：`if (process.env.NODE_ENV === 'development') { console.log(...) }`

3. **在代码仓库中使用**：
   - 在执行实际清理前，先提交当前更改
   - 使用单独分支进行日志清理
   - 清理后进行全面测试，确保功能正常

4. **长期解决方案**：
   - 考虑引入专业日志库，如 `loglevel` 或 `winston`
   - 在构建流程中添加自动移除开发日志的步骤
   - 在代码审查中关注不必要的日志语句 