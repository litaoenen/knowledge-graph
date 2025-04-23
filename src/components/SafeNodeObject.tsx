import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { Text, Billboard, Html } from '@react-three/drei';
import '../styles/tooltip.css';

// 节点类型
interface Node3D {
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

// 节点对象组件 - 移除了try-catch块以避免条件式钩子调用
const SafeNodeObject: React.FC<{
  node: Node3D;
  onClick: (id: string) => void;
  onDragStart: (id: string, position: THREE.Vector3) => void;
  onDrag: (id: string, position: THREE.Vector3) => void;
  onDragEnd: (id: string) => void;
  onRightClick?: (event: MouseEvent, position: THREE.Vector3) => void;
  isSelected: boolean;
}> = ({ node, onClick, onDragStart, onDrag, onDragEnd, onRightClick, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { camera, gl } = useThree();
  
  // 节点材质 - 使用局部变量
  const materialProps = isSelected 
    ? { color: '#FFD700', emissive: '#FF4500', emissiveIntensity: 0.5 }
    : { color: node.color, emissive: node.color, emissiveIntensity: 0.2 };
  
  // 判断节点类型，设置不同的形状和旋转
  const isKnowledge = node.nodeType === 'knowledge';
  
  // 节点高度，让节点有厚度
  const nodeHeight = node.radius * 0.4;
  
  // 节点初始位置设置
  useEffect(() => {
    // 当组件挂载时，设置初始位置
    if (meshRef.current && node.position) {
      meshRef.current.position.copy(node.position);
    }
  }, []);  // 仅在组件挂载时执行
  
  // 更新节点位置 - 减少不必要的位置更新，避免闪烁
  useEffect(() => {
    // 只有当节点不处于拖拽状态时才更新位置
    if (meshRef.current && node.position && !isDragging) {
      try {
        // 计算当前位置与目标位置的差距
        const currentPos = meshRef.current.position;
        const targetPos = node.position;
        const distance = currentPos.distanceTo(targetPos);
        
        // 只有当位置差距大于阈值时才更新，避免微小抖动导致的闪烁
        if (distance > 0.05) {
          // 使用lerp进行平滑过渡，而不是直接设置位置
          currentPos.lerp(targetPos, 0.3);
        }
      } catch (err) {
        console.error("节点位置更新错误:", err);
        setRenderError("节点位置更新失败");
      }
    }
  }, [node.position, isDragging]);
  
  // 处理指针悬停事件
  const handlePointerEnter = (e: ThreeEvent<PointerEvent>) => {
    try {
      e.stopPropagation();
      setShowTooltip(true);
      document.body.style.cursor = 'pointer';
    } catch (err) {
      console.error("指针悬停错误:", err);
    }
  };
  
  const handlePointerLeave = (e: ThreeEvent<PointerEvent>) => {
    try {
      e.stopPropagation();
      setShowTooltip(false);
      document.body.style.cursor = 'auto';
    } catch (err) {
      console.error("指针离开错误:", err);
    }
  };
  
  // 处理指针按下事件
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    try {
      e.stopPropagation();
      // 防止事件冒泡，避免多个节点同时响应事件
      e.nativeEvent?.preventDefault?.();
      
      // 检测是否为右键点击
      if (e.button === 2 && onRightClick) {
        // 右键点击时，直接调用右键事件处理函数，并标记为右键点击状态
        e.stopPropagation();
        onRightClick(e.nativeEvent, meshRef.current?.position.clone() || node.position);
        return;
      }
      
      // 记录原始位置，用于判断是否发生了拖拽
      const originalPosition = meshRef.current?.position.clone();
      setIsDragging(false);
      
      if (meshRef.current && originalPosition) {
        onDragStart(node.id, originalPosition);
      }
    } catch (err) {
      console.error("节点点击错误:", err);
      setRenderError("节点交互失败");
    }
  };
  
  // 处理指针移动事件 - 优化拖拽逻辑，防止位置跳跃
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!meshRef.current) return;
    
    try {
      // 防止事件冒泡
      e.stopPropagation();
      
      // 只有当鼠标按下时才响应移动
      if (e.buttons !== 1) return;
      
      // 设置为拖拽状态，但首次移动不更新位置，避免突然跳跃
      if (!isDragging) {
        setIsDragging(true);
        return;
      }
      
      // 获取鼠标3D位置
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(
        new THREE.Vector2(e.point.x, e.point.y), 
        camera
      );
      
      // 根据节点所在平面进行射线平面求交
      const planeZ = isKnowledge ? -5 : 5;
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
      const intersection = new THREE.Vector3();
      
      // 检查射线是否与平面相交
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        // 计算新位置和当前位置的距离
        const currentPos = meshRef.current.position;
        const distance = new THREE.Vector3(intersection.x, intersection.y, currentPos.z).distanceTo(currentPos);
        
        // 平滑过渡，避免位置突变 (限制单次移动距离)
        if (distance < 10) {
          // 更新位置 - 仅更新X和Y，保持Z不变
          const newX = currentPos.x + (intersection.x - currentPos.x) * 0.5;
          const newY = currentPos.y + (intersection.y - currentPos.y) * 0.5;
          
          meshRef.current.position.x = newX;
          meshRef.current.position.y = newY;
          
          onDrag(node.id, meshRef.current.position.clone());
        }
      }
    } catch (err) {
      console.error("节点拖拽错误:", err);
      setRenderError("拖拽操作失败");
    }
  };
  
  // 处理指针释放事件
  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    try {
      e.stopPropagation();
      
      // 如果是右键，不执行点击操作
      if (e.button === 2) {
        return;
      }
      
      if (isDragging) {
        // 如果是拖拽操作，则结束拖拽
        setIsDragging(false);
        onDragEnd(node.id);
      } else {
        // 如果不是拖拽操作，则认为是点击
        console.log("节点点击:", node.id);
        onClick(node.id);
      }
    } catch (err) {
      console.error("节点释放错误:", err);
      setRenderError("节点操作失败");
    }
  };
  
  // 处理上下文菜单（右键点击）
  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    try {
      // 阻止默认浏览器右键菜单
      e.nativeEvent.preventDefault();
      e.stopPropagation();
      
      // 如果有右键回调函数，调用它
      if (onRightClick && meshRef.current) {
        onRightClick(e.nativeEvent, meshRef.current.position.clone());
      }
    } catch (err) {
      console.error("右键菜单错误:", err);
      setRenderError("右键菜单失败");
    }
    
    // 确保阻止事件继续传播
    return false;
  };
  
  // 如果出现渲染错误，返回简化的节点
  if (renderError) {
    return (
      <mesh position={[node.position.x, node.position.y, node.position.z]}>
        <boxGeometry args={[node.radius, node.radius, 0.1]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
    );
  }
  
  return (
    <group>
      <mesh 
        ref={meshRef}
        position={[node.position.x, node.position.y, node.position.z]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
      >
        {/* 使用球体而不是圆柱体 */}
        <sphereGeometry args={[node.radius, 32, 32]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      
      {/* 还原节点标签样式 */}
      <Billboard 
        position={[node.position.x, node.position.y, node.position.z]}
        follow={true}
      >
        <Text
          position={[0, node.radius * 2.0, 0]}
          fontSize={0.9}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.25}
          outlineColor="#000000"
          fontWeight="bold"
          renderOrder={10}
          maxWidth={10}
        >
          {decodeURIComponent(encodeURIComponent(node.label))}
        </Text>
      </Billboard>
      
      {/* 调整提示框尺寸和位置 */}
      {showTooltip && (
        <Html 
          position={[node.position.x + node.radius * 1.5, node.position.y + node.radius * 1.5, node.position.z]} // 保持右上角位置
          style={{
            pointerEvents: 'none',
            zIndex: 10000
          }}
          center={false}
          distanceFactor={0} // 保持为0确保固定大小
        >
          <div className="drei-tooltip">
            <div className="drei-tooltip-content">
              {/* 标题 */}
              <div className="drei-tooltip-title">
                {node.label}
              </div>
              
              {/* ID */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">ID:</span>
                <span className="drei-tooltip-value">{node.id}</span>
              </div>
              
              {/* 类型 */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">类型:</span>
                <span className="drei-tooltip-value">{node.type}</span>
              </div>
              
              {/* 图谱类型 */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">图谱:</span>
                <span className="drei-tooltip-value">{node.nodeType === 'knowledge' ? '知识' : '能力'}</span>
              </div>
              
              {/* 难度 */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">难度:</span>
                <span className="drei-tooltip-value">{(node.difficulty * 10).toFixed(1)}</span>
              </div>
              
              {/* 重要性 */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">重要性:</span>
                <span className="drei-tooltip-value">{(node.importance * 10).toFixed(1)}</span>
              </div>
              
              {/* 标签 */}
              {node.tag && (
                <div className="drei-tooltip-item">
                  <span className="drei-tooltip-label">标签:</span>
                  <span className="drei-tooltip-value">{node.tag}</span>
                </div>
              )}
              
              {/* 子节点 */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">子节点:</span>
                <span className="drei-tooltip-value">{node.children.length}</span>
              </div>
              
              {/* 状态 */}
              <div className="drei-tooltip-item">
                <span className="drei-tooltip-label">状态:</span>
                <span className="drei-tooltip-value">{node.isExpanded ? '已展开' : '已收起'}</span>
              </div>
              
              {/* 描述 */}
              {node.description && (
                <div className="drei-tooltip-description">
                  <div className="drei-tooltip-label">描述:</div>
                  <div className="drei-tooltip-value">{node.description}</div>
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default SafeNodeObject; 