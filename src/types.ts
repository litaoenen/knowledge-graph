import * as THREE from 'three';

// 基础节点接口
export interface Node {
  id: string;
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  difficulty: number;
  importance: number;
  description?: string;
  children?: Node[];
  expanded?: boolean;
  visible?: boolean;
  parentId?: string;
}

// Cytoscape事件接口
export interface CyEvent {
  target: {
    id: () => string;
    data: (key?: string) => any;
    [key: string]: any;
  };
  type: string;
  [key: string]: any;
}

// 边接口
export interface Edge {
  data: {
    id: string;
    source: string;
    target: string;
    type?: string;
    strength?: number;
    description?: string;
    display?: boolean;
    color?: string;
  }
}

// 3D节点接口
export interface Node3D {
  id: string;
  label: string;
  type: 'chapter' | 'section' | 'subsection' | 'point' | 'detail';
  nodeType: 'knowledge' | 'ability';
  difficulty: number;
  importance: number;
  description?: string;
  tag?: string;
  position: THREE.Vector3;
  color: string;
  radius: number;
  children: Node3D[];
  isExpanded: boolean;
}

// 3D边接口
export interface Edge3D {
  source: string;
  target: string;
  sourcePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

// 提示消息接口
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// 上下文菜单项接口
export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
}

// 搜索结果接口
export interface SearchResult {
  id: string;
  label: string;
  type: string;
  nodeType: string;
} 