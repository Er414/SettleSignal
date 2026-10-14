"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function SignalCore({ confirmed, motion }: { confirmed: boolean; motion: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!motion) return;
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z = t * (confirmed ? 0.18 : 0.32);
      ring.current.rotation.x = Math.PI / 2.35;
    }
    if (inner.current) inner.current.rotation.y = t * 0.18;
    if (pulse.current) {
      const scale = 1 + Math.sin(t * 1.4) * 0.035;
      pulse.current.scale.setScalar(scale);
    }
  });
  const accent = confirmed ? "#3dcb8a" : "#d6f25c";
  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.68, 1]} />
        <meshStandardMaterial color="#161d24" metalness={0.92} roughness={0.22} />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[1.12, 0.028, 18, 140]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} metalness={0.35} roughness={0.28} />
      </mesh>
      <mesh ref={pulse} rotation={[1.05, 0.25, 0.2]}>
        <torusGeometry args={[1.58, 0.008, 12, 160]} />
        <meshStandardMaterial color="#8ecfff" emissive="#8ecfff" emissiveIntensity={0.4} metalness={0.2} roughness={0.35} />
      </mesh>
    </group>
  );
}

function InvoicePlanes({ motion }: { motion: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (motion && group.current) group.current.rotation.y = clock.elapsedTime * 0.16;
  });
  const cards = [
    { position: [1.85, 0.42, 0.15] as [number, number, number], rotation: [0.18, 0.45, 0.12] as [number, number, number] },
    { position: [-1.65, -0.18, 0.55] as [number, number, number], rotation: [0.1, -0.5, -0.08] as [number, number, number] },
    { position: [0.25, 1.18, -0.7] as [number, number, number], rotation: [-0.15, 0.2, 0.18] as [number, number, number] },
  ];
  return (
    <group ref={group}>
      {cards.map((card) => (
        <mesh key={card.position.join("-")} position={card.position} rotation={card.rotation}>
          <boxGeometry args={[0.78, 1.05, 0.028]} />
          <meshStandardMaterial color="#1b242d" metalness={0.45} roughness={0.38} />
        </mesh>
      ))}
    </group>
  );
}

function Particles({ count, motion }: { count: number; motion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const radius = 1.72 + (index % 4) * 0.14;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = ((index % 7) - 3) * 0.11;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.68;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (motion && ref.current) ref.current.rotation.y = clock.elapsedTime * 0.07;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#d6f25c" size={0.026} transparent opacity={0.78} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Rig({ children, parallax, motion }: { children: React.ReactNode; parallax: boolean; motion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!parallax) return;
    const onMove = (event: PointerEvent) => {
      pointer.current.x = event.clientX / window.innerWidth - 0.5;
      pointer.current.y = event.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [parallax]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = motion ? clock.elapsedTime : 0;
    const targetY = t * 0.08 + (parallax ? pointer.current.x * 0.35 : 0);
    const targetX = Math.sin(t * 0.2) * 0.05 + (parallax ? pointer.current.y * -0.12 : 0);
    ref.current.rotation.y += (targetY - ref.current.rotation.y) * 0.05;
    ref.current.rotation.x += (targetX - ref.current.rotation.x) * 0.05;
  });
  return <group ref={ref}>{children}</group>;
}

export default function SettlementScene({
  variant,
  confirmed,
  active,
}: {
  variant: "hero" | "compact";
  confirmed: boolean;
  active: boolean;
}) {
  const compact = variant === "compact";
  const count = compact ? 24 : 64;
  return (
    <Canvas
      camera={{ position: [0, 0.15, compact ? 3.5 : 4.15], fov: 38 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true, powerPreference: "default" }}
    >
      <ambientLight intensity={0.38} />
      <directionalLight position={[3.2, 3.4, 2.4]} intensity={1.5} color="#f4f1ea" />
      <pointLight position={[-2.2, -0.6, 1.8]} intensity={6} color="#d6f25c" distance={8} />
      <pointLight position={[2.1, 1.1, -1.6]} intensity={3.5} color="#8ecfff" distance={8} />
      <Rig parallax={!compact} motion={active}>
        <SignalCore confirmed={confirmed} motion={active} />
        {compact ? null : <InvoicePlanes motion={active} />}
        <Particles count={count} motion={active} />
      </Rig>
    </Canvas>
  );
}
