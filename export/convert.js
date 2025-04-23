const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 路径配置
const knowledgeGraphPath = path.join(__dirname, '../build/knowledge_graph.xlsx');
const abilityGraphPath = path.join(__dirname, '../build/ability_graph.xlsx');
const outputPath = path.join(__dirname, './graph_data.json');

// 解析Excel文件
function parseExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } catch (error) {
    console.error(`解析Excel文件出错: ${filePath}`, error);
    return [];
  }
}

// 主函数
function convertToJson() {
  console.log('开始转换Excel数据到JSON...');
  
  const knowledgeData = parseExcel(knowledgeGraphPath);
  console.log(`读取知识图谱数据: ${knowledgeData.length} 条记录`);
  
  const abilityData = parseExcel(abilityGraphPath);
  console.log(`读取能力图谱数据: ${abilityData.length} 条记录`);
  
  const graphData = {
    knowledge: knowledgeData,
    ability: abilityData
  };
  
  // 写入JSON文件
  fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2), 'utf8');
  console.log(`JSON数据已写入到: ${outputPath}`);
}

// 执行转换
convertToJson(); 
 