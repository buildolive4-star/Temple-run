import * as THREE from 'three';

export interface ProceduralTextures {
  flagstoneMap: THREE.CanvasTexture;
  flagstoneBump: THREE.CanvasTexture;
  stonePillarMap: THREE.CanvasTexture;
  cliffRockMap: THREE.CanvasTexture;
  ornateGoldMap: THREE.CanvasTexture;
  clothWeaveBump: THREE.CanvasTexture;
  metalHammeredBump: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  sparkleMap: THREE.CanvasTexture;
  flameMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  // 1. Weathered Ancient Temple Flagstone Path Albedo + Bump (1024x1024)
  // Authentic sandstone & basalt masonry with recessed dark mortar, natural moss edges, no neon strips
  const [flagCanvas, fCtx] = makeCanvas(1024, 1024);
  const [bumpCanvas, bCtx] = makeCanvas(1024, 1024);

  // Deep earthy mortar base
  fCtx.fillStyle = '#1d1914';
  fCtx.fillRect(0, 0, 1024, 1024);
  bCtx.fillStyle = '#242424';
  bCtx.fillRect(0, 0, 1024, 1024);

  const cols = 6;
  const rows = 8;
  const cw = 1024 / cols;
  const rh = 1024 / rows;

  for (let r = 0; r < rows; r++) {
    const rowOffset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + rowOffset;
      const y = r * rh;
      const hash = Math.abs(Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
      const base = 70 + Math.floor(hash * 24);
      const warm = 12 + Math.floor(((hash * 17) % 1) * 10);

      // Clipped slab rect inside [0, 1024]
      const sx = Math.max(0, x + 5);
      const ex = Math.min(1024, x + cw - 5);
      const sw = ex - sx;
      if (sw <= 2) continue;

      fCtx.fillStyle = `rgb(${base + warm}, ${base + 4}, ${base - 10})`;
      fCtx.fillRect(sx, y + 5, sw, rh - 10);

      const bVal = 155 + Math.floor(hash * 50);
      bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bCtx.fillRect(sx, y + 5, sw, rh - 10);

      // Subtle weathered chisel bevel (top-left catchlight, bottom-right shadow)
      fCtx.strokeStyle = 'rgba(210, 188, 152, 0.14)';
      fCtx.lineWidth = 2.5;
      fCtx.beginPath();
      fCtx.moveTo(sx + 2, y + rh - 7);
      fCtx.lineTo(sx + 2, y + 7);
      fCtx.lineTo(ex - 2, y + 7);
      fCtx.stroke();

      fCtx.strokeStyle = 'rgba(14, 11, 8, 0.42)';
      fCtx.beginPath();
      fCtx.moveTo(ex - 2, y + 7);
      fCtx.lineTo(ex - 2, y + rh - 7);
      fCtx.lineTo(sx + 2, y + rh - 7);
      fCtx.stroke();
    }
  }

  // Subtle recessed dark-stone lane guide grooves (realistic carved channels, zero glow)
  const laneXs = [Math.round(1024 / 3), Math.round((1024 * 2) / 3)];
  for (const lx of laneXs) {
    fCtx.fillStyle = 'rgba(22, 18, 14, 0.55)';
    fCtx.fillRect(lx - 7, 0, 14, 1024);
    fCtx.fillStyle = 'rgba(98, 86, 70, 0.35)';
    fCtx.fillRect(lx - 3, 0, 6, 1024);
    bCtx.fillStyle = '#383838';
    bCtx.fillRect(lx - 6, 0, 12, 1024);
  }

  // Subtle weathered stone lotus medallions carved in low relief down the center
  for (let m = 0; m < 4; m++) {
    const cy = 128 + m * 256;
    const cx = 512;
    fCtx.strokeStyle = 'rgba(34, 28, 22, 0.42)';
    fCtx.lineWidth = 4;
    fCtx.beginPath();
    fCtx.arc(cx, cy, 46, 0, Math.PI * 2);
    fCtx.stroke();

    fCtx.strokeStyle = 'rgba(175, 146, 104, 0.18)';
    fCtx.lineWidth = 2;
    fCtx.beginPath();
    fCtx.arc(cx, cy, 42, 0, Math.PI * 2);
    fCtx.stroke();

    bCtx.strokeStyle = 'rgb(115, 115, 115)';
    bCtx.lineWidth = 4;
    bCtx.beginPath();
    bCtx.arc(cx, cy, 46, 0, Math.PI * 2);
    bCtx.stroke();

    for (let p = 0; p < 8; p++) {
      const ang = (p / 8) * Math.PI * 2;
      fCtx.strokeStyle = 'rgba(34, 28, 22, 0.34)';
      fCtx.beginPath();
      fCtx.moveTo(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14);
      fCtx.lineTo(cx + Math.cos(ang) * 42, cy + Math.sin(ang) * 42);
      fCtx.stroke();
    }
  }

  // Stone grain, pits, cracks & edge moss weathering
  for (let i = 0; i < 6500; i++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    const rad = 1 + Math.random() * 3.5;
    const edgeFactor = Math.abs(px - 512) / 512;
    if (Math.random() < (edgeFactor > 0.72 ? 0.32 : 0.08)) {
      // Natural olive jungle moss near curbs & crevices
      fCtx.fillStyle = 'rgba(42, 68, 34, 0.36)';
    } else if (Math.random() < 0.55) {
      fCtx.fillStyle = 'rgba(16, 13, 10, 0.22)';
    } else {
      fCtx.fillStyle = 'rgba(196, 174, 142, 0.12)';
    }
    fCtx.fillRect(px, py, rad, rad);
  }

  // Weathered dark basalt curb borders
  fCtx.fillStyle = '#3b3329';
  fCtx.fillRect(0, 0, 30, 1024);
  fCtx.fillRect(994, 0, 30, 1024);
  fCtx.fillStyle = 'rgba(20, 16, 12, 0.55)';
  fCtx.fillRect(28, 0, 5, 1024);
  fCtx.fillRect(991, 0, 5, 1024);

  const flagstoneMap = new THREE.CanvasTexture(flagCanvas);
  flagstoneMap.colorSpace = THREE.SRGBColorSpace;
  flagstoneMap.wrapS = THREE.ClampToEdgeWrapping;
  flagstoneMap.wrapT = THREE.RepeatWrapping;
  flagstoneMap.anisotropy = maxAnisotropy;

  const flagstoneBump = new THREE.CanvasTexture(bumpCanvas);
  flagstoneBump.wrapS = THREE.ClampToEdgeWrapping;
  flagstoneBump.wrapT = THREE.RepeatWrapping;
  flagstoneBump.anisotropy = maxAnisotropy;

  // 2. Sculpted Weathered Sandstone Masonry & Frieze Texture (512x512)
  const [pillarCanvas, pCtx] = makeCanvas(512, 512);
  pCtx.fillStyle = '#3c332a';
  pCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    const shade = 68 + ((y / 64) % 3) * 10;
    pCtx.fillStyle = `rgb(${shade + 14}, ${shade + 5}, ${shade - 8})`;
    pCtx.fillRect(0, y + 3, 512, 58);

    // Carved stone relief band (muted aged sandstone & dark recess)
    if ((y / 64) % 2 === 0) {
      pCtx.fillStyle = 'rgba(156, 124, 78, 0.34)';
      pCtx.fillRect(0, y + 22, 512, 10);
      pCtx.fillStyle = 'rgba(24, 18, 12, 0.45)';
      for (let gx = 8; gx < 512; gx += 32) {
        pCtx.fillRect(gx, y + 24, 14, 6);
      }
    }
  }
  for (let i = 0; i < 2800; i++) {
    const py = Math.random() * 512;
    const mossBias = py > 340 ? 0.34 : 0.14;
    pCtx.fillStyle =
      Math.random() < mossBias ? 'rgba(42, 70, 34, 0.34)' : 'rgba(18, 14, 10, 0.18)';
    pCtx.fillRect(Math.random() * 512, py, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  const stonePillarMap = new THREE.CanvasTexture(pillarCanvas);
  stonePillarMap.colorSpace = THREE.SRGBColorSpace;
  stonePillarMap.wrapS = THREE.RepeatWrapping;
  stonePillarMap.wrapT = THREE.RepeatWrapping;
  stonePillarMap.anisotropy = maxAnisotropy;

  // 3. Stratified Mossy Canyon Basalt Cliff Texture (512x512)
  const [cliffCanvas, cCtx] = makeCanvas(512, 512);
  cCtx.fillStyle = '#252924';
  cCtx.fillRect(0, 0, 512, 512);
  // Horizontal sedimentary rock strata bands
  for (let y = 0; y < 512; y += 24) {
    const v = 32 + Math.floor(Math.sin(y * 0.08) * 10 + Math.random() * 14);
    cCtx.fillStyle = `rgb(${v + 4}, ${v + 5}, ${v})`;
    cCtx.fillRect(0, y, 512, 22);
  }
  for (let i = 0; i < 4200; i++) {
    const v = 28 + Math.floor(Math.random() * 44);
    const isMoss = Math.random() < 0.22;
    cCtx.fillStyle = isMoss
      ? `rgba(${34 + Math.floor(Math.random() * 18)}, ${58 + Math.floor(Math.random() * 26)}, 28, 0.55)`
      : `rgb(${v + 4}, ${v + 3}, ${v})`;
    cCtx.fillRect(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 12, 2 + Math.random() * 5);
  }
  cCtx.strokeStyle = 'rgba(10, 12, 10, 0.62)';
  cCtx.lineWidth = 2.5;
  for (let i = 0; i < 40; i++) {
    cCtx.beginPath();
    let sx = Math.random() * 512;
    let sy = Math.random() * 512;
    cCtx.moveTo(sx, sy);
    for (let s = 0; s < 5; s++) {
      sx += (Math.random() - 0.5) * 68;
      sy += (Math.random() - 0.5) * 38;
      cCtx.lineTo(sx, sy);
    }
    cCtx.stroke();
  }
  const cliffRockMap = new THREE.CanvasTexture(cliffCanvas);
  cliffRockMap.colorSpace = THREE.SRGBColorSpace;
  cliffRockMap.wrapS = THREE.RepeatWrapping;
  cliffRockMap.wrapT = THREE.RepeatWrapping;
  cliffRockMap.repeat.set(2, 2);
  cliffRockMap.anisotropy = maxAnisotropy;

  // 4. Aged Tarnished Temple Bronze/Gold Texture (256x256)
  const [goldCanvas, gCtx] = makeCanvas(256, 256);
  gCtx.fillStyle = '#a87828';
  gCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const streak = 160 + Math.floor(Math.random() * 48);
    gCtx.fillStyle = `rgba(${streak}, ${Math.floor(streak * 0.72)}, 36, 0.25)`;
    gCtx.fillRect(0, y, 256, 1);
  }
  gCtx.strokeStyle = 'rgba(62, 36, 12, 0.45)';
  gCtx.lineWidth = 4;
  gCtx.strokeRect(12, 12, 232, 232);
  const ornateGoldMap = new THREE.CanvasTexture(goldCanvas);
  ornateGoldMap.colorSpace = THREE.SRGBColorSpace;
  ornateGoldMap.anisotropy = maxAnisotropy;

  // 5. Woven Cloth Micro-Bump (256x256)
  const [clothCanvas, clCtx] = makeCanvas(256, 256);
  clCtx.fillStyle = '#808080';
  clCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const alt = ((x + y) / 4) % 2 === 0 ? 155 : 105;
      clCtx.fillStyle = `rgb(${alt},${alt},${alt})`;
      clCtx.fillRect(x, y, 3, 3);
    }
  }
  const clothWeaveBump = new THREE.CanvasTexture(clothCanvas);
  clothWeaveBump.wrapS = THREE.RepeatWrapping;
  clothWeaveBump.wrapT = THREE.RepeatWrapping;
  clothWeaveBump.repeat.set(6, 6);
  clothWeaveBump.anisotropy = maxAnisotropy;

  // 6. Hammered Armor Metal Bump (256x256)
  const [metalCanvas, mCtx] = makeCanvas(256, 256);
  mCtx.fillStyle = '#888888';
  mCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 350; i++) {
    const mx = Math.random() * 256;
    const my = Math.random() * 256;
    const mr = 4 + Math.random() * 10;
    const mg = mCtx.createRadialGradient(mx, my, 0, mx, my, mr);
    mg.addColorStop(0, 'rgba(65,65,65,0.5)');
    mg.addColorStop(1, 'rgba(175,175,175,0)');
    mCtx.fillStyle = mg;
    mCtx.beginPath();
    mCtx.arc(mx, my, mr, 0, Math.PI * 2);
    mCtx.fill();
  }
  const metalHammeredBump = new THREE.CanvasTexture(metalCanvas);
  metalHammeredBump.wrapS = THREE.RepeatWrapping;
  metalHammeredBump.wrapT = THREE.RepeatWrapping;
  metalHammeredBump.anisotropy = maxAnisotropy;

  // 7. Radial Contact Shadow
  const [shadowCanvas, sCtx] = makeCanvas(128, 128);
  const grad = sCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(6, 8, 12, 0.72)');
  grad.addColorStop(0.55, 'rgba(6, 8, 12, 0.34)');
  grad.addColorStop(1, 'rgba(6, 8, 12, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);

  // 8. Soft Sparkle / Dust Particle Sprite
  const [sparkCanvas, spCtx] = makeCanvas(64, 64);
  const spGrad = spCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
  spGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  spGrad.addColorStop(0.35, 'rgba(255, 235, 185, 0.78)');
  spGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
  spCtx.fillStyle = spGrad;
  spCtx.fillRect(0, 0, 64, 64);
  const sparkleMap = new THREE.CanvasTexture(sparkCanvas);

  // 9. Organic Teardrop Brazier Flame Sprite (128x128)
  const [flameCanvas, flCtx] = makeCanvas(128, 128);
  flCtx.clearRect(0, 0, 128, 128);
  const flGrad = flCtx.createRadialGradient(64, 86, 4, 64, 72, 54);
  flGrad.addColorStop(0, 'rgba(255, 248, 205, 0.95)');
  flGrad.addColorStop(0.28, 'rgba(255, 168, 52, 0.85)');
  flGrad.addColorStop(0.62, 'rgba(225, 72, 18, 0.42)');
  flGrad.addColorStop(1, 'rgba(180, 30, 0, 0)');
  flCtx.fillStyle = flGrad;
  flCtx.beginPath();
  flCtx.moveTo(64, 10);
  flCtx.bezierCurveTo(96, 42, 108, 86, 64, 118);
  flCtx.bezierCurveTo(20, 86, 32, 42, 64, 10);
  flCtx.fill();
  const flameMap = new THREE.CanvasTexture(flameCanvas);
  flameMap.colorSpace = THREE.SRGBColorSpace;

  return {
    flagstoneMap,
    flagstoneBump,
    stonePillarMap,
    cliffRockMap,
    ornateGoldMap,
    clothWeaveBump,
    metalHammeredBump,
    contactShadowMap,
    sparkleMap,
    flameMap,
    dispose: () => {
      flagstoneMap.dispose();
      flagstoneBump.dispose();
      stonePillarMap.dispose();
      cliffRockMap.dispose();
      ornateGoldMap.dispose();
      clothWeaveBump.dispose();
      metalHammeredBump.dispose();
      contactShadowMap.dispose();
      sparkleMap.dispose();
      flameMap.dispose();
    },
  };
}
