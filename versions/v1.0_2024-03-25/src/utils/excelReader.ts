import { read, utils } from 'xlsx';

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
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

const getNodeType = (id: string): KnowledgeNode['type'] => {
  const length = id.length;
  switch (length) {
    case 4: return 'chapter';
    case 6: return 'section';
    case 8: return 'subsection';
    case 10: return 'point';
    default: return 'detail';
  }
}; 