/**
 * 控制台日志清理脚本
 * 用于扫描和清理项目中的console.log语句
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

// 配置
const CONFIG = {
  // 要扫描的目录
  targetDirs: ['src'],
  // 要扫描的文件扩展名
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  // 要忽略的目录
  ignoreDirs: ['node_modules', 'build', 'dist', '.git'],
  // 保留某些文件的日志（相对路径）
  preserveLogsIn: [
    'src/reportWebVitals.ts' 
  ],
  // 控制台方法模式
  consolePattern: /console\.(log|debug|info)/, 
  // 使用dry run模式，只显示会被清理的内容，但不实际修改文件
  dryRun: true,
  // 是否仅报告找到的控制台日志，不进行替换
  reportOnly: false,
  // 是否替换为注释
  replaceWithComment: true,
  // 是否仅清理有特定字符串的日志
  filterString: null, // 例如: '节点' 只会清理包含"节点"的日志
};

// 统计信息
const stats = {
  filesScanned: 0,
  filesWithLogs: 0,
  totalLogsFound: 0,
  logsRemoved: 0
};

/**
 * 扫描目录中的所有相关文件
 */
async function scanDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // 忽略指定目录
    if (entry.isDirectory()) {
      if (!CONFIG.ignoreDirs.includes(entry.name)) {
        await scanDirectory(fullPath);
      }
      continue;
    }
    
    // 只处理指定扩展名的文件
    const ext = path.extname(entry.name);
    if (CONFIG.fileExtensions.includes(ext)) {
      await processFile(fullPath);
    }
  }
}

/**
 * 处理单个文件，查找和清理console.log
 */
async function processFile(filePath) {
  // 检查是否应该保留此文件的日志
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (CONFIG.preserveLogsIn.includes(relativePath)) {
    console.log(`跳过文件(保留日志): ${relativePath}`);
    return;
  }
  
  stats.filesScanned++;
  
  try {
    // 读取文件内容
    const content = await readFile(filePath, 'utf8');
    // 使用正则表达式查找所有console.log语句
    const lines = content.split('\n');
    let modified = false;
    let fileLogsCount = 0;
    
    const newLines = lines.map(line => {
      if (CONFIG.consolePattern.test(line)) {
        // 如果有过滤字符串且该行不包含过滤字符串，则跳过此行
        if (CONFIG.filterString && !line.includes(CONFIG.filterString)) {
          return line;
        }
        
        fileLogsCount++;
        stats.totalLogsFound++;
        
        // 如果只是报告模式，不替换
        if (CONFIG.reportOnly) {
          return line;
        }
        
        // 进行替换
        modified = true;
        stats.logsRemoved++;
        
        if (CONFIG.replaceWithComment) {
          // 替换为注释
          return line.replace(CONFIG.consolePattern, '// $&');
        } else {
          // 删除整行console.log语句，如果这一行只有console.log
          if (line.trim().startsWith('console.')) {
            return '';
          }
          // 对于嵌入在其他代码中的console.log，替换为空字符串
          return line.replace(CONFIG.consolePattern + '\\([^)]*\\);?', '');
        }
      }
      return line;
    });
    
    if (fileLogsCount > 0) {
      stats.filesWithLogs++;
      console.log(`检查到日志: ${relativePath} (${fileLogsCount}条)`);
      
      // 如果有修改且不是dry run模式，写入文件
      if (modified && !CONFIG.dryRun) {
        await writeFile(filePath, newLines.join('\n'), 'utf8');
        console.log(`  已清理文件: ${relativePath}`);
      } else if (modified) {
        console.log(`  [Dry Run] 将会清理文件: ${relativePath}`);
      }
    }
  } catch (error) {
    console.error(`处理文件时出错 ${filePath}: ${error.message}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('开始扫描控制台日志...');
  console.log(`模式: ${CONFIG.dryRun ? '模拟运行' : '实际清理'}`);
  console.log(`操作: ${CONFIG.reportOnly ? '仅报告' : CONFIG.replaceWithComment ? '替换为注释' : '移除'}`);
  
  if (CONFIG.filterString) {
    console.log(`过滤条件: 仅处理包含 "${CONFIG.filterString}" 的日志`);
  }
  
  // 扫描所有目标目录
  for (const dir of CONFIG.targetDirs) {
    await scanDirectory(dir);
  }
  
  // 输出统计信息
  console.log('\n--- 统计信息 ---');
  console.log(`扫描的文件数: ${stats.filesScanned}`);
  console.log(`包含日志的文件数: ${stats.filesWithLogs}`);
  console.log(`发现的日志总数: ${stats.totalLogsFound}`);
  
  if (!CONFIG.reportOnly) {
    console.log(`${CONFIG.dryRun ? '将被' : '已'}移除的日志数: ${stats.logsRemoved}`);
  }
  
  console.log('\n使用说明:');
  console.log('1. 当前为安全模式(dryRun: true)，只会显示将被修改的内容但不实际修改文件');
  console.log('2. 确认上述输出无误后，修改脚本开头的CONFIG对象中的dryRun为false实际执行清理');
  console.log('3. 可以通过filterString配置项指定只清理包含特定文本的日志');
}

// 执行主函数
main().catch(error => {
  console.error('脚本执行出错:', error);
}); 