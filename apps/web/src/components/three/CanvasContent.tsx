'use client';

import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei';
import { Suspense } from 'react';

function FloatingOrb() {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <Sphere args={[1.2, 64, 64]} scale={1.5}>
        <MeshDistortMaterial
          color="#8b5cf6"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  );
}

export function CanvasContent() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      className="h-full w-full"
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#a78bfa" />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#c4b5fd" />
      <Suspense fallback={null}>
        <FloatingOrb />
      </Suspense>
    </Canvas>
  );
}
