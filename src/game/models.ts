import * as THREE from 'three';
import type { HeroId, ObstacleKind, PowerupKind } from './types';
import type { ProceduralTextures } from './textures';

export interface RunnerRig {
  root: THREE.Group;
  squashRoot: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  scarfSeg1: THREE.Group;
  scarfSeg2: THREE.Group;
  scarfSeg3: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  shieldDome: THREE.Mesh;
  shieldRing: THREE.Mesh;
  boostRing: THREE.Mesh;
  boostWings: THREE.Group;
  contactShadow: THREE.Mesh;
}

export interface GuardianRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  crownRing: THREE.Mesh;
  eyeMeshes: THREE.Mesh[];
}

function makeBeveledStarShape(points: number, outerR: number, innerR: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

interface HeroPalette {
  tunicColor: number;
  armorColor: number;
  trouserColor: number;
  scarfColor: number;
  metalColor: number;
  gemColor: number;
  gemEmissive: number;
  skinColor: number;
  armorMetalness: number;
  armorRoughness: number;
}

const HERO_PALETTES: Record<Exclude<HeroId, 'custom_glb'>, HeroPalette> = {
  arjun: {
    tunicColor: 0xb54422,
    armorColor: 0x28343e,
    trouserColor: 0x222930,
    scarfColor: 0xd93026,
    metalColor: 0xf5c142,
    gemColor: 0xffd35a,
    gemEmissive: 0xff7b00,
    skinColor: 0xd69468,
    armorMetalness: 0.48,
    armorRoughness: 0.36,
  },
  rudra: {
    tunicColor: 0x1e2c4a,
    armorColor: 0xc9922c,
    trouserColor: 0x1a1f28,
    scarfColor: 0x2c4ea6,
    metalColor: 0xffe07d,
    gemColor: 0x45d6ff,
    gemEmissive: 0x0088ff,
    skinColor: 0xc9885e,
    armorMetalness: 0.88,
    armorRoughness: 0.22,
  },
  tara: {
    tunicColor: 0x1a2224,
    armorColor: 0x183834,
    trouserColor: 0x151b1e,
    scarfColor: 0x19b885,
    metalColor: 0xc9d8de,
    gemColor: 0x42ffbe,
    gemEmissive: 0x00c482,
    skinColor: 0xdfa37c,
    armorMetalness: 0.55,
    armorRoughness: 0.32,
  },
};

export function createRunnerModel(
  textures: ProceduralTextures,
  heroId: HeroId = 'arjun',
): RunnerRig {
  const effectiveHero = heroId === 'custom_glb' ? 'arjun' : heroId;
  const pal = HERO_PALETTES[effectiveHero];

  const root = new THREE.Group();
  const squashRoot = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.96;
  squashRoot.add(bodyPivot);
  root.add(squashRoot);

  // Tactile PBR Materials with cloth weave & hammered armor micro-detail
  const tunicMat = new THREE.MeshStandardMaterial({
    color: pal.tunicColor,
    bumpMap: textures.clothWeaveBump,
    bumpScale: 0.015,
    roughness: 0.84,
    metalness: 0.04,
  });
  const chestArmorMat = new THREE.MeshPhysicalMaterial({
    color: pal.armorColor,
    bumpMap: textures.metalHammeredBump,
    bumpScale: 0.018,
    roughness: pal.armorRoughness,
    metalness: pal.armorMetalness,
    clearcoat: 0.35,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: pal.trouserColor,
    bumpMap: textures.clothWeaveBump,
    bumpScale: 0.014,
    roughness: 0.88,
    metalness: 0.04,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x422414,
    bumpMap: textures.clothWeaveBump,
    bumpScale: 0.01,
    roughness: 0.45,
    metalness: 0.14,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: pal.skinColor,
    roughness: 0.56,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1a1412,
    roughness: 0.72,
    metalness: 0.08,
  });
  const metalMat = new THREE.MeshPhysicalMaterial({
    map: textures.ornateGoldMap,
    bumpMap: textures.metalHammeredBump,
    bumpScale: 0.015,
    color: pal.metalColor,
    roughness: 0.18,
    metalness: 0.94,
    clearcoat: 0.45,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: pal.scarfColor,
    bumpMap: textures.clothWeaveBump,
    bumpScale: 0.014,
    roughness: 0.74,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: pal.gemColor,
    emissive: pal.gemEmissive,
    emissiveIntensity: 1.85,
    roughness: 0.16,
    metalness: 0.4,
  });

  // 1. Anatomically Sculpted Torso (Athletic V-taper chest, narrow waist, hip flare)
  const torsoProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.18, 0.04),
    new THREE.Vector2(0.155, 0.19),
    new THREE.Vector2(0.245, 0.44),
    new THREE.Vector2(0.225, 0.56),
    new THREE.Vector2(0.085, 0.61),
    new THREE.Vector2(0.01, 0.62),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 16);
  torsoGeo.scale(1.14, 1.0, 0.72);
  const torso = new THREE.Mesh(torsoGeo, tunicMat);
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Sculpted Breastplate / Armor Cuirass
  const cuirassProfile = [
    new THREE.Vector2(0.16, 0.22),
    new THREE.Vector2(0.245, 0.41),
    new THREE.Vector2(0.22, 0.55),
    new THREE.Vector2(0.11, 0.58),
  ];
  const cuirassGeo = new THREE.LatheGeometry(cuirassProfile, 14);
  cuirassGeo.scale(1.16, 1.0, 0.76);
  const chestPlate = new THREE.Mesh(cuirassGeo, chestArmorMat);
  chestPlate.castShadow = true;
  bodyPivot.add(chestPlate);

  // Diagonal Leather Bandolier + Sculpted Chest Emblem
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 0.54, 0.12),
    new THREE.Vector3(0.0, 0.36, 0.18),
    new THREE.Vector3(0.2, 0.12, 0.13),
    new THREE.Vector3(0.22, 0.12, -0.14),
    new THREE.Vector3(-0.2, 0.52, -0.15),
  ]);
  const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 20, 0.03, 6, false), leatherMat);
  bodyPivot.add(strap);

  const sunShape = makeBeveledStarShape(effectiveHero === 'rudra' ? 8 : 6, 0.088, 0.044);
  const sunCrestGeo = new THREE.ExtrudeGeometry(sunShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  sunCrestGeo.center();
  const sunCrest = new THREE.Mesh(sunCrestGeo, metalMat);
  sunCrest.position.set(0, 0.39, 0.185);
  const chestGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), gemMat);
  chestGem.position.set(0, 0.39, 0.205);
  bodyPivot.add(sunCrest, chestGem);

  // Waist Belt + Tasset Skirting
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.11, 14), leatherMat);
  belt.scale.set(1.14, 1.0, 0.78);
  belt.position.y = 0.06;
  bodyPivot.add(belt);

  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.016, 6, 12), metalMat);
  buckle.position.set(0, 0.06, 0.17);
  bodyPivot.add(buckle);

  // Hero-Specific Back Gear
  if (effectiveHero === 'arjun') {
    const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.18, 6, 10), leatherMat);
    pack.scale.set(1.15, 1.0, 0.72);
    pack.position.set(0, 0.33, -0.2);
    pack.castShadow = true;
    const scrollTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 10), metalMat);
    scrollTube.rotation.z = Math.PI / 2;
    scrollTube.position.set(0, 0.51, -0.21);
    bodyPivot.add(pack, scrollTube);
  } else if (effectiveHero === 'rudra') {
    // Round Surya War-Shield strapped across back
    const backShield = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), chestArmorMat);
    backShield.rotation.x = Math.PI / 2;
    backShield.position.set(0, 0.36, -0.22);
    backShield.castShadow = true;
    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), metalMat);
    shieldBoss.position.set(0, 0.36, -0.26);
    bodyPivot.add(backShield, shieldBoss);
  } else {
    // Twin Crossed Jade-Hilted Daggers on Tara's back
    for (const s of [-1, 1]) {
      const scabbard = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, 0.46, 8), leatherMat);
      scabbard.position.set(s * 0.05, 0.34, -0.2);
      scabbard.rotation.z = s * 0.52;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.14, 8), gemMat);
      hilt.position.set(s * 0.18, 0.55, -0.2);
      hilt.rotation.z = s * 0.52;
      bodyPivot.add(scabbard, hilt);
    }
  }

  // 2. Anatomically Sculpted Head (Neck, Cranium, Jawline, Brow, Nose, Hero Headgear)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.62, 0);
  bodyPivot.add(headPivot);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.082, 0.11, 10), skinMat);
  neck.position.y = 0.03;
  headPivot.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.148, 16, 14), skinMat);
  cranium.scale.set(0.92, 1.12, 1.02);
  cranium.position.y = 0.21;
  cranium.castShadow = true;
  headPivot.add(cranium);

  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.075, 0.1, 10), skinMat);
  jaw.position.set(0, 0.115, 0.03);
  headPivot.add(jaw);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 5), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.195, 0.155);
  headPivot.add(nose);

  if (effectiveHero === 'rudra') {
    // Sculpted Crested Temple War-Helm with Glowing Sapphire Visor
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
      chestArmorMat,
    );
    helm.position.set(0, 0.22, -0.01);
    helm.castShadow = true;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.28), metalMat);
    crest.position.set(0, 0.39, -0.02);
    const visorL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 0.04), gemMat);
    visorL.position.set(-0.05, 0.215, 0.145);
    const visorR = visorL.clone();
    visorR.position.x = 0.05;
    headPivot.add(helm, crest, visorL, visorR);
  } else if (effectiveHero === 'tara') {
    // Hooded Cowl + Lower Face Mask + Glowing Emerald Eyes
    const cowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.172, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
      tunicMat,
    );
    cowl.position.set(0, 0.22, -0.02);
    cowl.rotation.x = -0.2;
    const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.115, 0.13, 12), chestArmorMat);
    mask.position.set(0, 0.135, 0.025);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.03), gemMat);
    eyeL.position.set(-0.048, 0.215, 0.145);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.048;
    headPivot.add(cowl, mask, eyeL, eyeR);
  } else {
    // Arjun: Windswept Hair + Crimson Headband + Sun Gem Circlet
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.158, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat,
    );
    hairCap.position.set(0, 0.22, -0.02);
    hairCap.rotation.x = -0.35;
    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.024, 6, 16), scarfMat);
    headband.rotation.x = Math.PI / 2 - 0.12;
    headband.position.set(0, 0.245, 0);
    const crownGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), gemMat);
    crownGem.position.set(0, 0.265, 0.16);
    headPivot.add(hairCap, headband, crownGem);
  }

  // 3-Segment Flowing Cloth Scarf / Mantle
  const scarfSeg1 = new THREE.Group();
  scarfSeg1.position.set(0, 0.58, -0.14);
  bodyPivot.add(scarfSeg1);
  const s1Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.025), scarfMat);
  s1Mesh.position.set(0, -0.12, -0.02);
  scarfSeg1.add(s1Mesh);

  const scarfSeg2 = new THREE.Group();
  scarfSeg2.position.set(0, -0.23, -0.02);
  scarfSeg1.add(scarfSeg2);
  const s2Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.02), scarfMat);
  s2Mesh.position.set(0, -0.12, 0);
  scarfSeg2.add(s2Mesh);

  const scarfSeg3 = new THREE.Group();
  scarfSeg3.position.set(0, -0.23, 0);
  scarfSeg2.add(scarfSeg3);
  const s3Mesh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), metalMat);
  s3Mesh.rotation.z = Math.PI;
  s3Mesh.scale.set(1.0, 1.0, 0.22);
  s3Mesh.position.set(0, -0.1, 0);
  scarfSeg3.add(s3Mesh);

  // 3. Anatomically Tapered Two-Joint Arms (Bicep Lathe -> Elbow -> Forearm Lathe + Vambrace)
  const bicepProfile = [
    new THREE.Vector2(0.048, -0.26),
    new THREE.Vector2(0.068, -0.13),
    new THREE.Vector2(0.062, 0.0),
  ];
  const bicepGeo = new THREE.LatheGeometry(bicepProfile, 10);

  const forearmProfile = [
    new THREE.Vector2(0.038, -0.22),
    new THREE.Vector2(0.056, -0.08),
    new THREE.Vector2(0.048, 0.0),
  ];
  const forearmGeo = new THREE.LatheGeometry(forearmProfile, 10);

  const makeArticulatedArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.295, 0.53, 0);

    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      metalMat,
    );
    pauldron.rotation.z = -side * 0.45;
    pauldron.castShadow = true;
    shoulder.add(pauldron);

    const upperArm = new THREE.Mesh(bicepGeo, tunicMat);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.26, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(forearmGeo, effectiveHero === 'arjun' ? skinMat : chestArmorMat);
    forearm.castShadow = true;
    elbow.add(forearm);

    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.048, 0.13, 10), metalMat);
    bracer.position.y = -0.14;
    elbow.add(bracer);

    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), leatherMat);
    fist.position.y = -0.24;
    elbow.add(fist);

    return { shoulder, elbow };
  };

  const leftArm = makeArticulatedArm(-1);
  const rightArm = makeArticulatedArm(1);
  bodyPivot.add(leftArm.shoulder, rightArm.shoulder);

  // 4. Anatomically Tapered Two-Joint Legs (Quad Lathe -> Knee -> Calf Greave Lathe + Sculpted Boot)
  const thighProfile = [
    new THREE.Vector2(0.068, -0.43),
    new THREE.Vector2(0.098, -0.18),
    new THREE.Vector2(0.095, 0.0),
  ];
  const thighGeo = new THREE.LatheGeometry(thighProfile, 12);

  const calfProfile = [
    new THREE.Vector2(0.052, -0.38),
    new THREE.Vector2(0.082, -0.14),
    new THREE.Vector2(0.068, 0.0),
  ];
  const calfGeo = new THREE.LatheGeometry(calfProfile, 12);

  const makeArticulatedLeg = (side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.135, 0, 0);

    const thigh = new THREE.Mesh(thighGeo, trouserMat);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const kneePad = new THREE.Mesh(new THREE.DodecahedronGeometry(0.078, 0), metalMat);
    kneePad.position.set(0, 0, 0.035);
    knee.add(kneePad);

    const shin = new THREE.Mesh(calfGeo, effectiveHero === 'rudra' ? metalMat : leatherMat);
    shin.castShadow = true;
    knee.add(shin);

    // Sculpted Boot Upper, Toe Cap & Heel Sole
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.11, 0.24), leatherMat);
    bootUpper.position.set(0, -0.43, 0.04);
    bootUpper.castShadow = true;
    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.074, 8, 6), metalMat);
    toeCap.scale.set(1.0, 0.72, 1.15);
    toeCap.position.set(0, -0.45, 0.15);
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.158, 0.04, 0.27), chestArmorMat);
    bootSole.position.set(0, -0.495, 0.048);
    knee.add(bootUpper, toeCap, bootSole);

    return { hip, knee };
  };

  const leftLeg = makeArticulatedLeg(-1);
  const rightLeg = makeArticulatedLeg(1);
  bodyPivot.add(leftLeg.hip, rightLeg.hip);

  // 5. Power-up Auras (Jade Hex Shield + Orbiting Ring + Agni Solar Wings)
  const shieldDome = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.12, 1),
    new THREE.MeshStandardMaterial({
      color: 0x39e6b2,
      emissive: 0x16a87f,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      depthWrite: false,
    }),
  );
  shieldDome.position.y = 1.05;
  shieldDome.visible = false;
  root.add(shieldDome);

  const shieldRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.02, 0.04, 6, 24),
    new THREE.MeshStandardMaterial({
      color: 0x6fffe0,
      emissive: 0x20c997,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  shieldRing.position.y = 1.05;
  shieldRing.visible = false;
  root.add(shieldRing);

  const boostRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.055, 8, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffb82e,
      emissive: 0xff7b00,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  boostRing.rotation.x = Math.PI / 2;
  boostRing.position.y = 0.28;
  boostRing.visible = false;
  root.add(boostRing);

  const boostWings = new THREE.Group();
  boostWings.position.set(0, 0.38, -0.24);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.85, 0.45);
  wingShape.lineTo(0.6, 0.05);
  wingShape.lineTo(0.92, -0.18);
  wingShape.lineTo(0, -0.22);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xffc947,
    emissive: 0xff6b00,
    emissiveIntensity: 1.7,
    transparent: true,
    opacity: 0.85,
  });
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.x = 0.12;
  wingR.rotation.y = -0.35;
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.scale.x = -1;
  wingL.position.x = -0.12;
  wingL.rotation.y = 0.35;
  boostWings.add(wingL, wingR);
  boostWings.visible = false;
  bodyPivot.add(boostWings);

  // 6. Grounded Contact Shadow
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  return {
    root,
    squashRoot,
    bodyPivot,
    headPivot,
    scarfSeg1,
    scarfSeg2,
    scarfSeg3,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
    leftLegPivot: leftLeg.hip,
    leftKneePivot: leftLeg.knee,
    rightLegPivot: rightLeg.hip,
    rightKneePivot: rightLeg.knee,
    shieldDome,
    shieldRing,
    boostRing,
    boostWings,
    contactShadow,
  };
}

export function createGuardianModel(textures: ProceduralTextures): GuardianRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 1.25;
  root.add(bodyPivot);

  const basaltMat = new THREE.MeshStandardMaterial({
    map: textures.cliffRockMap,
    color: 0x202328,
    roughness: 0.88,
    metalness: 0.14,
  });
  const bronzeMat = new THREE.MeshPhysicalMaterial({
    map: textures.ornateGoldMap,
    color: 0x8d6328,
    roughness: 0.36,
    metalness: 0.82,
  });
  const magmaMat = new THREE.MeshStandardMaterial({
    color: 0xd94814,
    emissive: 0xc22b00,
    emissiveIntensity: 0.85,
    roughness: 0.32,
  });

  // Sculpted Broad Colossus Torso
  const torsoProfile = [
    new THREE.Vector2(0.01, -0.05),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.34, 0.25),
    new THREE.Vector2(0.62, 0.78),
    new THREE.Vector2(0.56, 1.08),
    new THREE.Vector2(0.24, 1.18),
    new THREE.Vector2(0.01, 1.2),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 10);
  torsoGeo.scale(1.18, 1.0, 0.74);
  const torso = new THREE.Mesh(torsoGeo, basaltMat);
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Glowing Molten Magma Core & Chest Fissures
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), magmaMat);
  core.position.set(0, 0.64, -0.36);
  bodyPivot.add(core);

  const chestPlate = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 6, 8), bronzeMat);
  chestPlate.position.set(0, 0.64, -0.34);
  bodyPivot.add(chestPlate);

  // Sculpted Carved Basalt Temple Colossus Head (Brow, Cheek Plates, Crown Ridge)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.58), basaltMat);
  head.position.set(0, 1.44, -0.06);
  head.castShadow = true;
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.64), bronzeMat);
  brow.position.set(0, 1.62, -0.08);
  const jawPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.54), bronzeMat);
  jawPlate.position.set(0, 1.18, -0.1);
  bodyPivot.add(head, brow, jawPlate);

  // Curved Horns using TubeGeometry
  for (const side of [-1, 1]) {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.26, 1.64, -0.06),
      new THREE.Vector3(side * 0.52, 1.86, -0.02),
      new THREE.Vector3(side * 0.42, 2.16, -0.2),
    ]);
    const horn = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 10, 0.065, 6, false), bronzeMat);
    bodyPivot.add(horn);
  }

  // Ember Eyes (facing -Z toward runner)
  const eyeGeo = new THREE.BoxGeometry(0.14, 0.06, 0.06);
  const eyeL = new THREE.Mesh(eyeGeo, magmaMat);
  eyeL.position.set(-0.15, 1.48, -0.36);
  eyeL.rotation.z = -0.18;
  const eyeR = new THREE.Mesh(eyeGeo, magmaMat);
  eyeR.position.set(0.15, 1.48, -0.36);
  eyeR.rotation.z = 0.18;
  bodyPivot.add(eyeL, eyeR);

  // Carved Bronze Chakra Crown behind Guardian shoulders (no neon blowout)
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.045, 6, 14), bronzeMat);
  crownRing.position.set(0, 1.42, 0.26);
  bodyPivot.add(crownRing);

  // Massive Articulated Clawed Arms
  const makeArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.78, 0.96, 0);

    const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), bronzeMat);
    pauldron.castShadow = true;
    shoulder.add(pauldron);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 8), basaltMat);
    upper.position.y = -0.28;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.52, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), basaltMat);
    forearm.position.y = -0.22;
    elbow.add(forearm);

    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 5), magmaMat);
      claw.rotation.x = Math.PI + 0.3;
      claw.position.set(c * 0.09, -0.48, -0.08);
      elbow.add(claw);
    }

    return { shoulder, elbow };
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  bodyPivot.add(leftArm.shoulder, rightArm.shoulder);

  // Heavy Armored Legs
  const makeLeg = (side: -1 | 1): THREE.Group => {
    const p = new THREE.Group();
    p.position.set(side * 0.32, 0, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 8), basaltMat);
    thigh.position.y = -0.3;
    thigh.castShadow = true;
    p.add(thigh);
    const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8), bronzeMat);
    greave.position.y = -0.82;
    p.add(greave);
    return p;
  };
  const leftLegPivot = makeLeg(-1);
  const rightLegPivot = makeLeg(1);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  return {
    root,
    bodyPivot,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
    leftLegPivot,
    rightLegPivot,
    crownRing,
    eyeMeshes: [eyeL, eyeR],
  };
}

export function createCoinModel(): THREE.Group {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd24c,
    emissive: 0x6e3f00,
    emissiveIntensity: 0.4,
    metalness: 0.95,
    roughness: 0.14,
    clearcoat: 0.5,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0xff9f1c,
    emissive: 0xff6200,
    emissiveIntensity: 1.5,
    roughness: 0.18,
  });

  // Outer beveled octagonal ring
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 12), goldMat);
  g.add(outerRing);

  // Sculpted Starburst Core
  const starGeo = new THREE.ExtrudeGeometry(makeBeveledStarShape(6, 0.24, 0.12), {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  starGeo.center();
  const star = new THREE.Mesh(starGeo, goldMat);
  g.add(star);

  const centerGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), gemMat);
  g.add(centerGem);

  return g;
}

export function createPowerupModel(kind: PowerupKind): THREE.Group {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd25a,
    metalness: 0.94,
    roughness: 0.16,
    clearcoat: 0.5,
  });

  if (kind === 'shield') {
    const jadeMat = new THREE.MeshPhysicalMaterial({
      color: 0x2ee8ad,
      emissive: 0x0c8f66,
      emissiveIntensity: 1.2,
      metalness: 0.35,
      roughness: 0.15,
      clearcoat: 0.8,
    });
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 0.42);
    shieldShape.lineTo(0.34, 0.24);
    shieldShape.lineTo(0.28, -0.18);
    shieldShape.lineTo(0, -0.44);
    shieldShape.lineTo(-0.28, -0.18);
    shieldShape.lineTo(-0.34, 0.24);
    shieldShape.closePath();

    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    shieldGeo.center();
    const plate = new THREE.Mesh(shieldGeo, jadeMat);
    g.add(plate);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 24), goldMat);
    g.add(ring);
  } else if (kind === 'magnet') {
    const rubyMat = new THREE.MeshPhysicalMaterial({
      color: 0xff3b5c,
      emissive: 0xb80d2d,
      emissiveIntensity: 1.3,
      metalness: 0.4,
      roughness: 0.18,
    });
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.26, 0.26, 0),
      new THREE.Vector3(-0.26, -0.12, 0),
      new THREE.Vector3(0, -0.34, 0),
      new THREE.Vector3(0.26, -0.12, 0),
      new THREE.Vector3(0.26, 0.26, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.095, 8, false), rubyMat);
    g.add(tube);

    const tipL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 10), goldMat);
    tipL.position.set(-0.26, 0.3, 0);
    const tipR = tipL.clone();
    tipR.position.x = 0.26;
    g.add(tipL, tipR);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 24), goldMat);
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
  } else {
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffb326,
      emissive: 0xff6200,
      emissiveIntensity: 1.6,
      metalness: 0.6,
      roughness: 0.2,
    });
    const chakraGeo = new THREE.ExtrudeGeometry(makeBeveledStarShape(8, 0.42, 0.2), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    chakraGeo.center();
    const chakra = new THREE.Mesh(chakraGeo, goldMat);
    g.add(chakra);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), flameMat);
    g.add(core);
  }

  return g;
}

export function createObstacleModel(kind: ObstacleKind, textures: ProceduralTextures): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stonePillarMap,
    roughness: 0.88,
    metalness: 0.05,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x3b2413,
    roughness: 0.9,
    metalness: 0.04,
  });
  const bronzeMat = new THREE.MeshPhysicalMaterial({
    map: textures.ornateGoldMap,
    color: 0xa6742b,
    roughness: 0.34,
    metalness: 0.84,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x9aa4ad,
    roughness: 0.26,
    metalness: 0.9,
  });
  const warnEmissive = new THREE.MeshStandardMaterial({
    color: 0xd98626,
    emissive: 0x8f3800,
    emissiveIntensity: 0.42,
    roughness: 0.36,
    metalness: 0.35,
  });

  if (kind === 'low_barrier') {
    // Ornate Spiked Temple Hurdle (Jump Over!)
    for (const sx of [-0.94, 0.94]) {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.86, 8), stoneMat);
      plinth.position.set(sx, 0.43, 0);
      plinth.castShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bronzeMat);
      cap.position.set(sx, 0.92, 0);
      g.add(plinth, cap);
    }

    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.0, 10), woodMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(0, 0.7, 0);
    log.castShadow = true;
    g.add(log);

    // Glowing warning bands & forged steel spear blades
    for (const bx of [-0.5, 0.5]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 12), warnEmissive);
      band.rotation.y = Math.PI / 2;
      band.position.set(bx, 0.7, 0);
      g.add(band);
    }

    for (let sx = -0.68; sx <= 0.69; sx += 0.34) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.34, 4), steelMat);
      blade.position.set(sx, 1.0, 0);
      g.add(blade);
    }
  } else if (kind === 'high_arch') {
    // Ornate Stepped Torana Gate + Suspended Crescent Blade (Slide Under!)
    for (const sx of [-1.05, 1.05]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.56), stoneMat);
      base.position.set(sx, 0.19, 0);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 2.5, 8), stoneMat);
      col.position.set(sx, 1.62, 0);
      col.castShadow = true;
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.32, 8), bronzeMat);
      capital.position.set(sx, 2.9, 0);
      g.add(base, col, capital);
    }

    // Stepped Temple Lintel Roof
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.5, 0.54), stoneMat);
    lintel.position.set(0, 3.22, 0);
    lintel.castShadow = true;
    const crownTier = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.44), bronzeMat);
    crownTier.position.set(0, 3.62, 0);
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), warnEmissive);
    finial.position.set(0, 3.98, 0);
    g.add(lintel, crownTier, finial);

    // Suspended Blade Crossbeam (leaves 0..1.25m clear for heroic slide!)
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.65, 0.32), woodMat);
    beam.position.set(0, 1.76, 0);
    beam.castShadow = true;
    const warnTrim = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.14, 0.36), warnEmissive);
    warnTrim.position.set(0, 1.46, 0);
    g.add(beam, warnTrim);

    // Forged Steel Axe Teeth underneath
    for (let sx = -0.72; sx <= 0.73; sx += 0.36) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 4), steelMat);
      tooth.rotation.x = Math.PI;
      tooth.position.set(sx, 1.28, 0);
      g.add(tooth);
    }
  } else if (kind === 'monolith') {
    // Ancient Carved Surya Idol Totem (Dodge Left/Right!)
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.98, 0.48, 8), stoneMat);
    plinth.position.y = 0.24;
    plinth.castShadow = true;
    g.add(plinth);

    const bodyProfile = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.72, 0.02),
      new THREE.Vector2(0.62, 1.2),
      new THREE.Vector2(0.7, 1.9),
      new THREE.Vector2(0.55, 2.35),
      new THREE.Vector2(0.01, 2.45),
    ];
    const totemGeo = new THREE.LatheGeometry(bodyProfile, 8);
    const totem = new THREE.Mesh(totemGeo, stoneMat);
    totem.position.y = 0.48;
    totem.castShadow = true;
    g.add(totem);

    // Ornate Bronze Crown & Sun Halo behind Idol Head
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.075, 8, 16), bronzeMat);
    halo.position.set(0, 2.22, -0.35);
    g.add(halo);

    // Glowing Idol Eyes + Carved Nose Ridge
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.1), warnEmissive);
    eyeL.position.set(-0.2, 2.2, 0.56);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.2;
    const thirdEye = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), warnEmissive);
    thirdEye.position.set(0, 2.42, 0.58);
    g.add(eyeL, eyeR, thirdEye);
  } else if (kind === 'boulder') {
    // Forged Runic Rolling Temple Boulder
    const rockMat = new THREE.MeshStandardMaterial({
      map: textures.cliffRockMap,
      roughness: 0.78,
      metalness: 0.12,
    });
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.96, 1), rockMat);
    sphere.position.y = 0.96;
    sphere.castShadow = true;
    g.add(sphere);

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 20), bronzeMat);
    band.position.y = 0.96;
    const band2 = band.clone();
    band2.rotation.y = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.99, 0), warnEmissive);
    core.scale.set(0.32, 0.32, 0.32);
    core.position.set(0, 0.96, 0.75);
    g.add(band, band2, core);
  } else {
    // 'chakra_trap': Spinning Bronze & Steel Saw-Chakra Trap (Dodge or Jump!)
    const axleL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.05, 0.42), stoneMat);
    axleL.position.set(-0.98, 0.525, 0);
    axleL.castShadow = true;
    const axleR = axleL.clone();
    axleR.position.x = 0.98;
    const axleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.1, 8), bronzeMat);
    axleBar.rotation.z = Math.PI / 2;
    axleBar.position.y = 0.85;
    g.add(axleL, axleR, axleBar);

    // Spinning wheel sub-group (named for rotation in RunnerEngine!)
    const wheelGroup = new THREE.Group();
    wheelGroup.name = 'spin_wheel';
    wheelGroup.position.set(0, 0.85, 0);

    const bladeShape = makeBeveledStarShape(10, 0.82, 0.56);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
    });
    bladeGeo.center();
    const saw = new THREE.Mesh(bladeGeo, steelMat);
    saw.rotation.y = Math.PI / 2;
    saw.castShadow = true;
    wheelGroup.add(saw);

    const hub = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 16), warnEmissive);
    hub.rotation.y = Math.PI / 2;
    wheelGroup.add(hub);

    g.add(wheelGroup);
  }

  return g;
}
