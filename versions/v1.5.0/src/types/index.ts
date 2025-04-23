// 节点基础类型
export interface BaseNode {
  id: string;
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
  tag?: string;
}

// 知识节点
export interface KnowledgeNode extends BaseNode {
  nodeType: 'knowledge';
}

// 能力节点
export interface AbilityNode extends BaseNode {
  nodeType: 'ability';
  name?: string; // 额外的名称字段
}

// 映射关系
export interface KnowledgeAbilityMapping {
  knowledge_id: string;
  primary_ability_id: string;
  secondary_ability_id?: string;
  strength?: number;
}

// 2D图中的节点数据定义
export interface Node2D extends BaseNode {
  nodeType: 'knowledge' | 'ability';
  isRoot?: boolean;
  isExpanded?: boolean;
}

// 3D图表节点位置
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

// 3D图表节点
export interface Node3D {
  id: string;
  label: string;
  description?: string;
  difficulty: number;
  importance: number;
  tag?: string;
  nodeType: 'knowledge' | 'ability';
  position: Position3D;
  radius: number;
  color: string;
  children: Node3D[];
  isExpanded: boolean;
}

// 3D图表边
export interface Edge3D {
  source: string;
  target: string;
  sourcePosition: Position3D;
  targetPosition: Position3D;
  color: string;
  width: number;
} 