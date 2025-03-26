import * as THREE from 'three';
import { ReactThreeFiber } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group>;
      mesh: ReactThreeFiber.Object3DNode<THREE.Mesh, typeof THREE.Mesh>;
      points: ReactThreeFiber.Object3DNode<THREE.Points, typeof THREE.Points>;
      lineSegments: ReactThreeFiber.Object3DNode<THREE.LineSegments, typeof THREE.LineSegments>;
      line: ReactThreeFiber.Object3DNode<THREE.Line, typeof THREE.Line>;
      bufferGeometry: ReactThreeFiber.BufferGeometryNode<THREE.BufferGeometry, typeof THREE.BufferGeometry>;
    }
  }
} 