import React, { useState, useEffect, useRef, ReactNode, forwardRef } from 'react';
import { useThree, extend } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as THREE from 'three';

// 扩展OrbitControls以便在React中使用
extend({ OrbitControls });

interface SafeSceneProps {
  children: ReactNode;
  onClick?: (event: any) => void;
}

// 使用forwardRef创建可接收ref的组件
const SafeScene = forwardRef<any, SafeSceneProps>(({ children, onClick }, ref) => {
  const { camera, gl } = useThree();
  const [renderError, setRenderError] = useState<string | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // 初始化控制器
  useEffect(() => {
    try {
      // 确保相机处于正确的位置和方向
      camera.position.set(0, 0, 50);
      camera.lookAt(0, 0, 0);
      
      const controls = new OrbitControls(camera, gl.domElement);
      controlsRef.current = controls;
      
      // 启用控制，但保留一些限制
      controls.enabled = true; // 启用控制
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.8; // 增加旋转速度
      controls.zoomSpeed = 1.0; // 设置默认缩放速度
      
      // 使用默认的缩放行为
      controls.enableZoom = true;
      
      // 设置以鼠标位置为中心的缩放
      controls.screenSpacePanning = true;
      
      // 扩大视角范围，允许从更多角度观察
      controls.minPolarAngle = 0; // 从正上方开始
      controls.maxPolarAngle = Math.PI; // 到正下方
      
      // 关闭自动旋转
      controls.autoRotate = false;
      
      // 扩大距离限制
      controls.minDistance = 5; // 减小最小距离以便更近查看
      controls.maxDistance = 200; // 保持最大距离不变
      
      // 更新循环
      const animate = () => {
        requestAnimationFrame(animate);
        if (controls) controls.update();
      };
      animate();
      
      return () => {
        controls.dispose();
      };
    } catch (err) {
      console.error("控制器初始化错误:", err);
      setRenderError("场景初始化失败");
    }
  }, [camera, gl]);
  
  // 如果出现渲染错误，返回简化的场景
  if (renderError) {
    return (
      <>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
        <gridHelper />
      </>
    );
  }
  
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={0.5} />
      
      {/* 主光源 - 从正上方照射 */}
      <directionalLight 
        position={[10, 40, 30]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024}
      />
      
      {/* 辅助光源 - 从侧面照射，增加立体感 */}
      <directionalLight 
        position={[-20, 10, 20]} 
        intensity={0.4} 
        color="#aabbff"
      />
      
      {/* 背面补光 */}
      <directionalLight
        position={[0, -10, -30]}
        intensity={0.3}
        color="#ffeecc"
      />
      
      {/* 顶面专用光源 */}
      <spotLight
        position={[0, 30, 0]}
        angle={Math.PI / 3}
        penumbra={0.2}
        intensity={0.5}
        color="#ffffff"
        distance={60}
      />
      
      {/* 添加背景色 - 使用浅色背景 */}
      <color attach="background" args={['#f5f5f5']} />
      
      {/* 渲染子组件 */}
      <group ref={ref} onClick={onClick}>
        {children}
      </group>
    </>
  );
});

export default SafeScene; 