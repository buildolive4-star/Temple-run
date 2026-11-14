import * as THREE from 'three';
import { sharedGltfLoader } from './gltfCharacter';

export interface TempleEnvProps {
  palms: THREE.Group[];
  statue: THREE.Group | null;
  dispose: () => void;
}

function disposeGroupResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        const std = mat as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.normalMap?.dispose();
        std.roughnessMap?.dispose();
        std.metalnessMap?.dispose();
        std.emissiveMap?.dispose();
        mat.dispose();
      }
    }
  });
}

async function loadNormalizedProp(
  url: string,
  targetHeight: number,
  maxFootprint: number,
): Promise<THREE.Group | null> {
  try {
    const gltf = await sharedGltfLoader.loadAsync(url);
    const model = gltf.scene;

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          const std = mat as THREE.MeshStandardMaterial;
          std.envMapIntensity = 0.65;
          if (typeof std.roughness === 'number') {
            std.roughness = Math.max(std.roughness, 0.58);
          }
        }
      }
    });

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const safeHeight = Math.max(0.05, size.y);
    const safeWidth = Math.max(0.05, Math.max(size.x, size.z));
    const scaleFactor = Math.min(targetHeight / safeHeight, maxFootprint / safeWidth);

    const wrapper = new THREE.Group();
    model.scale.setScalar(scaleFactor);
    model.position.set(
      -center.x * scaleFactor,
      -box.min.y * scaleFactor,
      -center.z * scaleFactor,
    );
    wrapper.add(model);
    return wrapper;
  } catch {
    return null;
  }
}

export async function loadTempleEnvironmentProps(): Promise<TempleEnvProps> {
  const [coconutRes, palmRes, statueRes] = await Promise.all([
    loadNormalizedProp('/models/env_coconut_palm.glb', 8.8, 5.4),
    loadNormalizedProp('/models/env_palm_tree.glb', 8.0, 5.6),
    loadNormalizedProp('/models/env_temple_statue.glb', 4.1, 2.8),
  ]);

  const palms = [coconutRes, palmRes].filter(
    (g): g is THREE.Group => g !== null,
  );

  return {
    palms,
    statue: statueRes,
    dispose: () => {
      for (const g of palms) disposeGroupResources(g);
      if (statueRes) disposeGroupResources(statueRes);
    },
  };
}
