import * as THREE from 'three';

// Three flat light bands (shadow / mid / lit) give the cel-shaded cartoon look.
const gradient = new THREE.DataTexture(new Uint8Array([95, 170, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

export const OUTLINE_COLOR = 0x1a1030;

export function toonMaterial(map: THREE.Texture | null, color = 0xffffff, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ map, color, gradientMap: gradient, ...extra });
}

const outlineCache = new Map<string, THREE.MeshBasicMaterial>();

// Back-face "inverted hull": the mesh is drawn again, pushed out along its normals, in a dark colour.
// The push happens in begin_vertex, before skinning, so it follows animated characters too.
function outlineMaterial(thickness: number) {
  const key = thickness.toFixed(4);
  let m = outlineCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normalize(normal) * ${thickness.toFixed(5)};`,
      );
    };
    m.customProgramCacheKey = () => `outline-${key}`;
    outlineCache.set(key, m);
  }
  return m;
}

interface ToonOpts {
  hue?: number; // degrees to rotate the texture hue
  sat?: number;
  light?: number;
  tint?: number;
  outline?: number; // thickness in the object's own (unscaled) units; omit for no outline
}

// Replaces every standard material under `root` with a toon one (cloned, so per-instance tints are safe)
// and optionally adds the outline pass. Returns the new materials so callers can flash them.
export function toonify(root: THREE.Object3D, o: ToonOpts = {}) {
  const made: THREE.MeshToonMaterial[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const old = mesh.material as THREE.MeshStandardMaterial;
    const color = old.color?.clone() ?? new THREE.Color(0xffffff);
    if (o.tint !== undefined) color.multiply(new THREE.Color(o.tint));
    const map = old.map && o.hue !== undefined ? recolor(old.map, o.hue, o.sat ?? 1, o.light ?? 1) : (old.map ?? null);
    const mat = toonMaterial(map, 0xffffff, {
      vertexColors: old.vertexColors,
      transparent: old.transparent,
      opacity: old.opacity,
      alphaTest: old.alphaTest,
      side: old.side === THREE.BackSide ? THREE.BackSide : THREE.FrontSide,
    });
    mat.color.copy(color);
    made.push(mat);

    if (o.outline) {
      const g = mesh.geometry;
      if (!g.userData.outlined) {
        const count = g.index ? g.index.count : g.attributes.position.count;
        g.clearGroups();
        g.addGroup(0, count, 0);
        g.addGroup(0, count, 1);
        g.userData.outlined = true;
      }
      mesh.material = [mat, outlineMaterial(o.outline)];
    } else {
      mesh.material = mat;
    }
  });
  return made;
}

const recolorCache = new Map<string, THREE.Texture>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

// Hue-shifted copy of a texture (done per pixel, so it also works where canvas filters are missing, e.g. older iPads).
// This is how one model becomes several creatures: a barbarian turns into a green ghoul king.
export function recolor(src: THREE.Texture, hueShift: number, sat = 1, light = 1) {
  const key = `${src.uuid}|${hueShift}|${sat}|${light}`;
  const hit = recolorCache.get(key);
  if (hit) return hit;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const [h, s, l] = rgbToHsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    const [r, g, b] = hslToRgb((h + hueShift / 360 + 1) % 1, Math.min(1, s * sat), Math.min(1, l * light));
    px[i] = r * 255;
    px[i + 1] = g * 255;
    px[i + 2] = b * 255;
  }
  ctx.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = src.flipY;
  t.colorSpace = src.colorSpace;
  t.wrapS = src.wrapS;
  t.wrapT = src.wrapT;
  recolorCache.set(key, t);
  return t;
}
