import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export type CharacterAnimState = 'idle' | 'run' | 'jump' | 'slide';

export interface LoadedGltfCharacter {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<CharacterAnimState, THREE.AnimationAction>>;
  currentState: CharacterAnimState;
  hasRunClip: boolean;
  dispose: () => void;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.preload();

export const sharedGltfLoader = new GLTFLoader();
sharedGltfLoader.setDRACOLoader(dracoLoader);

function findMatchingClip(
  clips: THREE.AnimationClip[],
  keywords: string[],
): THREE.AnimationClip | null {
  for (const kw of keywords) {
    const found = clips.find((c) => c.name.toLowerCase().includes(kw));
    if (found) return found;
  }
  return null;
}

export async function loadGltfRunnerCharacter(url: string): Promise<LoadedGltfCharacter> {
  const gltf = await sharedGltfLoader.loadAsync(url);
  const model = gltf.scene;

  // Enable realistic shadows & PBR environment response
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.material && !Array.isArray(mesh.material)) {
        (mesh.material as THREE.MeshStandardMaterial).envMapIntensity = 1.0;
      }
    }
  });

  // Most GLTF characters face +Z; orient away from camera (-Z) before measuring bounds
  model.rotation.y = Math.PI;
  model.updateMatrixWorld(true);

  // Auto-normalize height to ~1.82m and ground bottom-center at (0, 0, 0)
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const targetHeight = 1.82;
  const safeHeight = Math.max(0.05, size.y);
  const scaleFactor = targetHeight / safeHeight;

  const wrapper = new THREE.Group();
  model.scale.setScalar(scaleFactor);
  model.position.set(
    -center.x * scaleFactor,
    -box.min.y * scaleFactor,
    -center.z * scaleFactor,
  );
  wrapper.add(model);

  let mixer: THREE.AnimationMixer | null = null;
  let hasRunClip = false;
  const actions: Partial<Record<CharacterAnimState, THREE.AnimationAction>> = {};

  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;

    const explicitRun = findMatchingClip(clips, ['run', 'sprint', 'jog', 'walk']);
    hasRunClip = Boolean(explicitRun);

    const idleClip = findMatchingClip(clips, ['idle', 'stand', 'breath']) || clips[0];
    const runClip = explicitRun || clips[0];
    const jumpClip = findMatchingClip(clips, ['jump', 'leap', 'air', 'fall']) || runClip;
    const slideClip = findMatchingClip(clips, ['slide', 'roll', 'crouch', 'duck', 'dodge']) || runClip;

    if (idleClip) actions.idle = mixer.clipAction(idleClip);
    if (runClip) actions.run = mixer.clipAction(runClip);
    if (jumpClip) actions.jump = mixer.clipAction(jumpClip);
    if (slideClip) actions.slide = mixer.clipAction(slideClip);

    actions.idle?.play();
  }

  return {
    root: wrapper,
    mixer,
    actions,
    currentState: 'idle',
    hasRunClip,
    dispose: () => {
      mixer?.stopAllAction();
      wrapper.traverse((obj) => {
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
    },
  };
}

export function setGltfCharacterState(
  character: LoadedGltfCharacter,
  nextState: CharacterAnimState,
): void {
  if (!character.mixer || character.currentState === nextState) return;
  const prevAction = character.actions[character.currentState];
  const nextAction = character.actions[nextState] || character.actions.run || character.actions.idle;
  if (!nextAction) return;

  if (prevAction && prevAction !== nextAction) {
    nextAction.reset().setEffectiveTimeScale(nextState === 'run' ? 1.25 : 1.0).setEffectiveWeight(1).play();
    prevAction.crossFadeTo(nextAction, 0.14, true);
  } else if (!prevAction) {
    nextAction.reset().play();
  }
  character.currentState = nextState;
}
