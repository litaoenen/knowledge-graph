import { read, utils } from 'xlsx';

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
}

export interface AbilityNode {
  id: string;
  label: string;
  name: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
  tag?: string;
}

export const readExcelFile = async (file: ArrayBuffer): Promise<KnowledgeNode[]> => {
  const workbook = read(file);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = utils.sheet_to_json(worksheet);

  return jsonData.map((row: any) => ({
    id: row['编号'],
    label: row['Name'],
    // 根据编号长度判断类型
    type: getNodeType(row['编号']),
    difficulty: Number(row['Difficulty_degree']) || 0,
    importance: Number(row['Importance_degree']) || 0,
    description: row['Description']
  }));
};

export const readAbilityExcelFile = async (file: ArrayBuffer): Promise<AbilityNode[]> => {
  const workbook = read(file);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = utils.sheet_to_json(worksheet);

  return jsonData.map((row: any) => ({
    id: row['编号'],
    label: row['Name'],
    name: row['Label'],
    // 根据编号长度判断类型
    type: getNodeType(row['编号']),
    difficulty: Number(row['难度']) || 0,
    importance: Number(row['重要性']) || 0,
    description: row['描述'],
    tag: row['标签']
  }));
};

const getNodeType = (id: string): KnowledgeNode['type'] => {
  const length = id.length;
  switch (length) {
    case 2: return 'chapter';
    case 4: return 'section';
    case 6: return 'subsection';
    case 8: return 'point';
    case 10: return 'detail';
    default: return 'detail';
  }
};

// 添加读取知识点-能力点映射关系的函数
export const readKnowledgeAbilityMappingExcel = async (fileBuffer: ArrayBuffer): Promise<{ knowledge: string, ability: string }[]> => {
  try {
    const workbook = read(fileBuffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json(sheet, { header: 1 });
    
    // 连接关系数组
    const connections: { knowledge: string, ability: string }[] = [];
    
    // 分析表头找到关键列的索引
    const headerRow = jsonData[0] as string[];
    const knowledgeIdIndex = headerRow.findIndex(h => h === '知识点ID' || h === '知识点编号');
    const mainAbilityIdIndex = headerRow.findIndex(h => h === '主能力编号');
    const subAbilityIdIndex = headerRow.findIndex(h => h === '次能力编号');
    
    if (knowledgeIdIndex === -1 || mainAbilityIdIndex === -1 || subAbilityIdIndex === -1) {
      console.error('映射表格格式不正确，找不到所需的列头');
      return [];
    }
    
    // 从第二行开始遍历数据（跳过表头）
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as string[];
      
      // 跳过空行
      if (!row || !row[knowledgeIdIndex]) continue;
      
      const knowledgeId = row[knowledgeIdIndex];
      const mainAbilityId = row[mainAbilityIdIndex];
      const subAbilityId = row[subAbilityIdIndex];
      
      // 添加主能力连接
      if (mainAbilityId) {
        connections.push({
          knowledge: knowledgeId,
          ability: mainAbilityId
        });
      }
      
      // 添加次能力连接
      if (subAbilityId) {
        connections.push({
          knowledge: knowledgeId,
          ability: subAbilityId
        });
      }
    }
    
    console.log(`从映射表格中读取了 ${connections.length} 条连接关系`);
    return connections;
  } catch (error) {
    console.error('读取Excel映射文件出错:', error);
    return [];
  }
}; 