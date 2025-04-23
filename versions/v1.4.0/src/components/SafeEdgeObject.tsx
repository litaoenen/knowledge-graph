import React, { useState } from 'react';
import * as THREE from 'three';

// 使用与Graph3D.tsx相同的接口定义
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

// 边类型
interface Edge3D {
  source: string;
  target: string;
  sourcePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

// 安全的边对象组件
const SafeEdgeObject: React.FC<{
  source: THREE.Vector3;
  target: THREE.Vector3;
  sourceType: 'knowledge' | 'ability';
  isSelected?: boolean;
}> = ({ source, target, sourceType, isSelected = false }) => {
  const [renderError, setRenderError] = useState<string | null>(null);
  
  try {
    if (!source || !target) {
      throw new Error("无效的边缘数据");
    }
    
    // 获取源节点和目标节点的位置
    const start = new THREE.Vector3(source.x, source.y, source.z);
    const end = new THREE.Vector3(target.x, target.y, target.z);
    
    // 如果源节点和目标节点在不同的平面上，则需要调整连线方式
    const isDifferentPlane = Math.abs(start.z - end.z) > 20;
    
    // 计算连线长度
    const length = start.distanceTo(end);
    
    // 如果是不同平面的节点，需要使用曲线连接
    if (isDifferentPlane) {
      // 构建贝塞尔曲线路径
      const midPoint = new THREE.Vector3().addVectors(start, end).divideScalar(2);
      
      // 控制点位于两个平面的中间
      const controlPoint = new THREE.Vector3(
        midPoint.x,
        midPoint.y,
        0 // 控制点放在Z=0的中间层
      );

      // 创建曲线路径
      const curve = new THREE.QuadraticBezierCurve3(
        start,
        controlPoint,
        end
      );
      
      // 创建曲线几何体
      const points = curve.getPoints(50);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // 获取从起点到终点的方向向量
      const direction = new THREE.Vector3().subVectors(end, start).normalize();

      return (
        <group>
          <primitive object={new THREE.Line(
            lineGeometry,
            new THREE.LineBasicMaterial({ 
              color: isSelected ? "#ffcc00" : "#aaaaaa",
              linewidth: 2,
              opacity: 0.8,
              transparent: true
            })
          )} />
          
          {/* 添加箭头指示方向 */}
          {points.length > 30 && (
            <mesh 
              position={points[30].toArray()} 
              scale={0.2}
              rotation={[0, 0, Math.atan2(direction.y, direction.x)]}
            >
              <coneGeometry args={[0.5, 1, 8]} />
              <meshBasicMaterial color={isSelected ? "#ffcc00" : "#aaaaaa"} />
            </mesh>
          )}
        </group>
      );
    } else {
      // 相同平面上的节点也使用曲线连接，但曲率更小
      // 计算边缘的方向和长度
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const length = start.distanceTo(end);
      
      // 使用二次贝塞尔曲线连接相同平面的节点
      const midPoint = new THREE.Vector3().addVectors(start, end).divideScalar(2);
      
      // 根据连线长度动态调整控制点偏移量
      const offsetFactor = Math.min(1, length / 15); // 连线越长，偏移越明显，但有上限
      const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
      
      // 添加随机性，使相邻连线错开
      const randomSign = Math.random() > 0.5 ? 1 : -1;
      const offsetMagnitude = length * 0.25 * offsetFactor * randomSign; // 偏移量为线长的25%
      
      // 控制点沿垂直于连线方向偏移
      const controlPoint = new THREE.Vector3(
        midPoint.x + perpendicular.x * offsetMagnitude,
        midPoint.y + perpendicular.y * offsetMagnitude,
        midPoint.z + (Math.random() * 0.4 - 0.2) // 小幅Z轴随机偏移
      );
      
      // 创建曲线路径
      const curve = new THREE.QuadraticBezierCurve3(
        start,
        controlPoint,
        end
      );
      
      // 创建曲线几何体
      const points = curve.getPoints(50);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // 计算箭头位置点（在曲线3/4位置）
      const arrowPosition = curve.getPoint(0.75);
      
      // 计算该点的切线方向作为箭头朝向
      const tangent = curve.getTangent(0.75).normalize();
      
      return (
        <group>
          <primitive object={new THREE.Line(
            lineGeometry,
            new THREE.LineBasicMaterial({ 
              color: isSelected ? "#ffcc00" : "#aaaaaa",
              linewidth: 2,
              opacity: 0.8,
              transparent: true
            })
          )} />
          
          {/* 添加箭头指示方向 */}
          <mesh 
            position={arrowPosition.toArray()}
            scale={0.2}
            rotation={[Math.PI/2, 0, Math.atan2(tangent.y, tangent.x)]}
          >
            <coneGeometry args={[0.5, 1, 8]} />
            <meshBasicMaterial color={isSelected ? "#ffcc00" : "#aaaaaa"} />
          </mesh>
        </group>
      );
    }
  } catch (error) {
    console.error("边缘渲染错误:", error);
    
    if (!renderError) {
      setRenderError(error instanceof Error ? error.message : "未知错误");
    }
    
    // 渲染一个简单的红色线条作为回退
    if (source && target) {
      const start = new THREE.Vector3(source.x, source.y, source.z);
      const end = new THREE.Vector3(target.x, target.y, target.z);
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      
      return (
        <primitive object={new THREE.Line(
          lineGeometry,
          new THREE.LineBasicMaterial({ color: "#ff0000", linewidth: 1 })
        )} />
      );
    }
  }
  
  // 如果一切都失败了，返回null
  return null;
};

export default SafeEdgeObject; 