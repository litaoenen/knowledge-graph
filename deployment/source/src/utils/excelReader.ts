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