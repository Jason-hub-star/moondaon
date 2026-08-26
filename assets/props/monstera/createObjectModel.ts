import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

function buildTubeGeometry(
  path: { points: [number, number, number][]; radius?: number; radialSegments?: number; closed?: boolean },
): THREE.TubeGeometry {
  const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, path.closed ?? false);
  const tubularSegments = Math.max(8, path.points.length * 6);
  return new THREE.TubeGeometry(curve, tubularSegments, path.radius ?? 0.05, path.radialSegments ?? 8, path.closed ?? false);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Monstera Potted Plant
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createMonsteraPottedPlantModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Monstera Potted Plant";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["ceramic-glaze"] = createSculptMaterial(
    "ceramic-glaze",
    {"id": "ceramic-glaze", "name": "white glazed ceramic", "class": "ceramic", "pbr": {"baseColor": "#e9e7e2", "metalness": 0.0, "roughness": 0.25}, "notes": "유광 도자기 — 하이라이트 밴드 관찰", "finishClass": "worn-composite", "texturePalette": ["#eae8e3", "#dedbd4", "#d3cfc7", "#c8c4bb", "#efede9"], "proceduralTexture": "mottle", "metalness": {"base": 0.0, "variation": 0.0}, "roughness": {"base": 0.28, "variation": 0.05, "map": "pbr/ceramic-glaze_roughness.png"}, "clearcoat": {"base": 0.4, "variation": 0.0}, "clearcoatRoughness": {"base": 0.0, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 0.5, "agentVisionOverride": "유광 글레이즈 — worn-composite/rough 0.9는 음영면 크롭 오독. 림 하이라이트 밴드 근거로 보정", "referencePbr": {"extractionConfidence": 0.86, "usable": true, "confidence": 0.86, "maps": {"albedo": {"path": "pbr/ceramic-glaze_albedo.png"}, "normal": {"path": "pbr/ceramic-glaze_normal.png"}, "roughness": {"path": "pbr/ceramic-glaze_roughness.png"}, "ao": {"path": "pbr/ceramic-glaze_ao.png"}, "height": {"path": "pbr/ceramic-glaze_height.png"}}, "sourceImage": "crop-pot.jpg", "method": "extract_pbr_evidence.py heuristic inverse", "verdict": "usable-with-agent-override", "targetThreshold": 0.95, "routeNote": "평면 마감 → 단색 알베도 경로(스킬 원칙). 크롭 추출물은 증거로만 보존"}, "textureProjection": {"mode": "uv", "texelDensity": "512px/m — 원경 소품 기준"}, "ambientOcclusion": {"source": "pbr/ceramic-glaze_ao.png", "intensity": 0.6, "notes": "접합부·골 감쇠"}, "surfaceFrequencyBands": [{"id": "macro", "description": "형상 실루엣·색 구배", "frequency": 2.0, "amplitude": 0.03}, {"id": "meso", "description": "리브·림 굴곡", "frequency": 18.0, "amplitude": 0.006}, {"id": "micro", "description": "글레이즈 스펙큘러", "frequency": 140.0, "amplitude": 0.0012}], "textureResolution": 1024, "localOverrides": [{"id": "fluting-ao", "mask": "rib groove AO mask", "effect": "리브 골 음영 강화"}, {"id": "soil-rim-stain", "mask": "inner rim 상단 밴드", "effect": "흙 얼룩 미세 틴트"}], "colorVariation": {"palette": ["#eae8e3", "#dedbd4", "#d3cfc7", "#c8c4bb", "#efede9"], "mode": "index-mask 명도 변주"}, "baseColor": "#e9e7e2"},
    options
  );
  materialMap["soil-mulch"] = createSculptMaterial(
    "soil-mulch",
    {"id": "soil-mulch", "name": "bark mulch soil", "class": "wood", "pbr": {"baseColor": "#2e2119", "metalness": 0.0, "roughness": 1.0}, "notes": "굵은 바크칩, 완전 무광", "textureProjection": {"mode": "uv", "texelDensity": "512px/m — 원경 소품 기준"}, "ambientOcclusion": {"source": "pbr/soil-mulch_ao.png", "intensity": 0.6, "notes": "접합부·골 감쇠"}, "surfaceFrequencyBands": [{"id": "macro", "description": "형상 실루엣·색 구배", "frequency": 2.0, "amplitude": 0.03}, {"id": "meso", "description": "바크칩 덩어리", "frequency": 18.0, "amplitude": 0.006}, {"id": "micro", "description": "미세 거칠기", "frequency": 140.0, "amplitude": 0.0012}], "textureResolution": 1024, "referencePbr": {"usable": true, "confidence": 0.86, "sourceImage": "crop-soil.jpg", "method": "extract_pbr_evidence.py heuristic inverse", "verdict": "usable", "maps": {"albedo": {"path": "pbr/soil-mulch_albedo.png"}, "roughness": {"path": "pbr/soil-mulch_roughness.png"}, "height": {"path": "pbr/soil-mulch_height.png"}, "normal": {"path": "pbr/soil-mulch_normal.png"}, "ao": {"path": "pbr/soil-mulch_ao.png"}}, "targetThreshold": 0.95, "routeNote": "평면 마감 → 단색 알베도 경로(스킬 원칙). 크롭 추출물은 증거로만 보존"}, "roughness": {"base": 1.0, "variation": 0.1, "map": "pbr/soil-mulch_roughness.png"}, "localOverrides": [{"id": "chip-variation", "mask": "voronoi chip mask", "effect": "칩별 명도 ±15%"}], "colorVariation": {"palette": ["#2e2119", "#42301f", "#241a12", "#4d3a26", "#1d150e"], "mode": "index-mask 명도 변주"}, "texturePalette": ["#2e2119", "#42301f", "#241a12", "#4d3a26", "#1d150e"], "baseColor": "#2e2119"},
    options
  );
  materialMap["stem-green"] = createSculptMaterial(
    "stem-green",
    {"id": "stem-green", "name": "stem/petiole green", "class": "unknown", "pbr": {"baseColor": "#5a7a42", "metalness": 0.0, "roughness": 0.6}, "notes": "기부는 카키·갈색 틴트", "textureProjection": {"mode": "uv", "texelDensity": "512px/m — 원경 소품 기준"}, "ambientOcclusion": {"source": "pbr/stem-green_ao.png", "intensity": 0.6, "notes": "접합부·골 감쇠"}, "surfaceFrequencyBands": [{"id": "macro", "description": "형상 실루엣·색 구배", "frequency": 2.0, "amplitude": 0.03}, {"id": "meso", "description": "마디·굴곡", "frequency": 18.0, "amplitude": 0.006}, {"id": "micro", "description": "미세 거칠기", "frequency": 140.0, "amplitude": 0.0012}], "textureResolution": 1024, "referencePbr": {"usable": true, "confidence": 0.86, "sourceImage": "crop-stem.jpg", "method": "extract_pbr_evidence.py heuristic inverse", "verdict": "usable", "maps": {"albedo": {"path": "pbr/stem-green_albedo.png"}, "roughness": {"path": "pbr/stem-green_roughness.png"}, "height": {"path": "pbr/stem-green_height.png"}, "normal": {"path": "pbr/stem-green_normal.png"}, "ao": {"path": "pbr/stem-green_ao.png"}}, "targetThreshold": 0.95, "routeNote": "평면 마감 → 단색 알베도 경로(스킬 원칙). 크롭 추출물은 증거로만 보존"}, "roughness": {"base": 0.6, "variation": 0.1, "map": "pbr/stem-green_roughness.png"}, "localOverrides": [{"id": "basal-brown", "mask": "하단 30% gradient", "effect": "카키·갈색 혼합"}], "colorVariation": {"palette": ["#5a7a42", "#68854a", "#4e6b3a", "#7a6a4f", "#617f47"], "mode": "index-mask 명도 변주"}, "texturePalette": ["#5a7a42", "#68854a", "#4e6b3a", "#7a6a4f", "#617f47"], "baseColor": "#5a7a42"},
    options
  );
  materialMap["leaf-satin"] = createSculptMaterial(
    "leaf-satin",
    {"id": "leaf-satin", "name": "monstera leaf", "class": "unknown", "pbr": {"baseColor": "#2f6633", "metalness": 0.0, "roughness": 0.4}, "notes": "새틴 광택, DoubleSide, 미세 투과. 잎맥은 밝은 값", "finishClass": "candy-coat", "texturePalette": ["#2f6633", "#3d7a3f", "#478347", "#295a2e", "#5d9556"], "proceduralTexture": "mottle", "metalness": {"base": 0.0, "variation": 0.0}, "roughness": {"base": 0.42, "variation": 0.08, "map": "pbr/leaf-satin_roughness.png"}, "clearcoat": {"base": 0.25, "variation": 0.0}, "clearcoatRoughness": {"base": 0.4, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 0.7, "agentVisionOverride": "잎은 유전체(cuticle 새틴 광) — candy-coat/metal 0.35는 웜 조명 하이라이트 오독. 시각 판정으로 보정", "referencePbr": {"extractionConfidence": 0.86, "usable": true, "confidence": 0.86, "maps": {"albedo": {"path": "pbr/leaf-satin_albedo.png"}, "normal": {"path": "pbr/leaf-satin_normal.png"}, "roughness": {"path": "pbr/leaf-satin_roughness.png"}, "ao": {"path": "pbr/leaf-satin_ao.png"}, "height": {"path": "pbr/leaf-satin_height.png"}}, "sourceImage": "crop-leaf.jpg", "method": "extract_pbr_evidence.py heuristic inverse", "verdict": "usable-with-agent-override", "targetThreshold": 0.95, "routeNote": "평면 마감 → 단색 알베도 경로(스킬 원칙). 크롭 추출물은 증거로만 보존"}, "textureProjection": {"mode": "uv", "texelDensity": "512px/m — 원경 소품 기준"}, "ambientOcclusion": {"source": "pbr/leaf-satin_ao.png", "intensity": 0.6, "notes": "접합부·골 감쇠"}, "surfaceFrequencyBands": [{"id": "macro", "description": "형상 실루엣·색 구배", "frequency": 2.0, "amplitude": 0.03}, {"id": "meso", "description": "잎맥·절개 경계", "frequency": 18.0, "amplitude": 0.006}, {"id": "micro", "description": "큐티클 새틴 스펙큘러", "frequency": 140.0, "amplitude": 0.0012}], "textureResolution": 1024, "localOverrides": [{"id": "vein-lightening", "mask": "midrib+pinnate vein procedural mask", "effect": "albedo +12% value"}, {"id": "edge-dry-tint", "mask": "blade rim 3% band", "effect": "황변 틴트 미세"}], "colorVariation": {"palette": ["#2f6633", "#3d7a3f", "#478347", "#295a2e", "#5d9556"], "mode": "index-mask 명도 변주"}, "baseColor": "#2f6633"},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_saucer_0 = null;
  const endpoint_saucer_0 = makeAttachmentEndpoint(attachment_saucer_0);
  const node_saucer_0 = new THREE.Group();
  node_saucer_0.name = "saucer__pivot";
  if (endpoint_saucer_0) {
    node_saucer_0.position.copy(endpoint_saucer_0.start);
    node_saucer_0.rotation.set(0, 0, 0);
    node_saucer_0.scale.set(1, 1, 1);
  } else {
    node_saucer_0.position.set(0, 0, 0);
    node_saucer_0.rotation.set(0, 0, 0);
    node_saucer_0.scale.set(1, 1, 1);
  }
  node_saucer_0.userData.sculptComponent = {"id": "saucer", "name": "saucer", "level": "macro", "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "받침 접시 회전 프로파일 — 굴림 테두리(우하단 크롭)", "material": "ceramic-glaze", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 231, 226, 1)", "secondaryAlbedo": "rgba(210, 206, 198, 1)", "materialClass": "ceramic", "materialClassConfidence": 0.9}, "actionProfile": {"animatable": false, "pivot": {"ref": "origin"}}, "geometryDescriptor": {"latheProfile": {"points": [[0.005, 0.0], [0.11, 0.0], [0.125, 0.008], [0.132, 0.022], [0.122, 0.03], [0.112, 0.024]], "segments": 48}}};
  node_saucer_0.userData.actionProfile = {"animatable": false, "pivot": {"ref": "origin"}};
  (nodes["root"] ?? root).add(node_saucer_0);
  nodes["saucer"] = node_saucer_0;
  const mesh_saucer_0Geometry = endpoint_saucer_0
    ? new THREE.CylinderGeometry(endpoint_saucer_0.endRadius, endpoint_saucer_0.baseRadius, endpoint_saucer_0.length, 32, 12)
    : buildLatheGeometry({"points": [[0.005, 0.0], [0.11, 0.0], [0.125, 0.008], [0.132, 0.022], [0.122, 0.03], [0.112, 0.024]], "segments": 48});
  const mesh_saucer_0 = new THREE.Mesh(
    mesh_saucer_0Geometry,
    materialMap["ceramic-glaze"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_saucer_0.name = "saucer";
  if (endpoint_saucer_0) {
    mesh_saucer_0.position.copy(endpoint_saucer_0.midpoint);
    mesh_saucer_0.quaternion.copy(endpoint_saucer_0.quaternion);
  }
  mesh_saucer_0.castShadow = options.castShadow ?? true;
  mesh_saucer_0.receiveShadow = options.receiveShadow ?? true;
  mesh_saucer_0.userData.sculptComponent = {"id": "saucer", "name": "saucer", "level": "macro", "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "받침 접시 회전 프로파일 — 굴림 테두리(우하단 크롭)", "material": "ceramic-glaze", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 231, 226, 1)", "secondaryAlbedo": "rgba(210, 206, 198, 1)", "materialClass": "ceramic", "materialClassConfidence": 0.9}, "actionProfile": {"animatable": false, "pivot": {"ref": "origin"}}, "geometryDescriptor": {"latheProfile": {"points": [[0.005, 0.0], [0.11, 0.0], [0.125, 0.008], [0.132, 0.022], [0.122, 0.03], [0.112, 0.024]], "segments": 48}}};
  node_saucer_0.add(mesh_saucer_0);
  meshes["saucer"] = mesh_saucer_0;
  colliders["saucer"] = {};

  const attachment_pot_1 = null;
  const endpoint_pot_1 = makeAttachmentEndpoint(attachment_pot_1);
  const node_pot_1 = new THREE.Group();
  node_pot_1.name = "pot-body__pivot";
  if (endpoint_pot_1) {
    node_pot_1.position.copy(endpoint_pot_1.start);
    node_pot_1.rotation.set(0, 0, 0);
    node_pot_1.scale.set(1, 1, 1);
  } else {
    node_pot_1.position.set(0.0, 0.028, 0.0);
    node_pot_1.rotation.set(0, 0, 0);
    node_pot_1.scale.set(1, 1, 1);
  }
  node_pot_1.userData.sculptComponent = {"id": "pot", "name": "pot-body", "level": "macro", "primitive": "lathe", "parent": "saucer", "topologyClass": "continuous-sculpt", "topologyRationale": "굽 플레어→벨 몸통→굴림 림 연속 프로파일", "material": "ceramic-glaze", "transform": {"position": [0, 0.028, 0]}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 231, 226, 1)", "secondaryAlbedo": "rgba(208, 204, 196, 1)", "materialClass": "ceramic", "materialClassConfidence": 0.9}, "actionProfile": {"animatable": false, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "pot-fluting", "type": "surface-relief", "description": "상부 패널형 세로 리브"}, {"id": "pot-foot-flare", "type": "silhouette", "description": "하단 굽 플레어"}], "geometryDescriptor": {"latheProfile": {"points": [[0.005, 0.0], [0.085, 0.0], [0.115, 0.012], [0.1, 0.045], [0.128, 0.13], [0.148, 0.22], [0.15, 0.265], [0.158, 0.285], [0.15, 0.3], [0.138, 0.292]], "segments": 64}}};
  node_pot_1.userData.actionProfile = {"animatable": false, "pivot": {"ref": "origin"}};
  (nodes["saucer"] ?? root).add(node_pot_1);
  nodes["pot"] = node_pot_1;
  const mesh_pot_1Geometry = endpoint_pot_1
    ? new THREE.CylinderGeometry(endpoint_pot_1.endRadius, endpoint_pot_1.baseRadius, endpoint_pot_1.length, 32, 12)
    : buildLatheGeometry({"points": [[0.005, 0.0], [0.085, 0.0], [0.115, 0.012], [0.1, 0.045], [0.128, 0.13], [0.148, 0.22], [0.15, 0.265], [0.158, 0.285], [0.15, 0.3], [0.138, 0.292]], "segments": 64});
  const mesh_pot_1 = new THREE.Mesh(
    mesh_pot_1Geometry,
    materialMap["ceramic-glaze"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pot_1.name = "pot-body";
  if (endpoint_pot_1) {
    mesh_pot_1.position.copy(endpoint_pot_1.midpoint);
    mesh_pot_1.quaternion.copy(endpoint_pot_1.quaternion);
  }
  mesh_pot_1.castShadow = options.castShadow ?? true;
  mesh_pot_1.receiveShadow = options.receiveShadow ?? true;
  mesh_pot_1.userData.sculptComponent = {"id": "pot", "name": "pot-body", "level": "macro", "primitive": "lathe", "parent": "saucer", "topologyClass": "continuous-sculpt", "topologyRationale": "굽 플레어→벨 몸통→굴림 림 연속 프로파일", "material": "ceramic-glaze", "transform": {"position": [0, 0.028, 0]}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 231, 226, 1)", "secondaryAlbedo": "rgba(208, 204, 196, 1)", "materialClass": "ceramic", "materialClassConfidence": 0.9}, "actionProfile": {"animatable": false, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "pot-fluting", "type": "surface-relief", "description": "상부 패널형 세로 리브"}, {"id": "pot-foot-flare", "type": "silhouette", "description": "하단 굽 플레어"}], "geometryDescriptor": {"latheProfile": {"points": [[0.005, 0.0], [0.085, 0.0], [0.115, 0.012], [0.1, 0.045], [0.128, 0.13], [0.148, 0.22], [0.15, 0.265], [0.158, 0.285], [0.15, 0.3], [0.138, 0.292]], "segments": 64}}};
  node_pot_1.add(mesh_pot_1);
  meshes["pot"] = mesh_pot_1;
  colliders["pot"] = {};

  const attachment_soil_2 = {"parentId": "pot", "parentSocket": "pot-rim-inner", "contactType": "embed", "localStart": [0, 0.255, 0], "localEnd": [0, 0.285, 0], "baseRadius": 0.132, "endRadius": 0.142, "embedDepth": 0.03, "gapTolerance": 0.003};
  const endpoint_soil_2 = makeAttachmentEndpoint(attachment_soil_2);
  const node_soil_2 = new THREE.Group();
  node_soil_2.name = "soil-mulch__pivot";
  if (endpoint_soil_2) {
    node_soil_2.position.copy(endpoint_soil_2.start);
    node_soil_2.rotation.set(0, 0, 0);
    node_soil_2.scale.set(1, 1, 1);
  } else {
    node_soil_2.position.set(0, 0, 0);
    node_soil_2.rotation.set(0, 0, 0);
    node_soil_2.scale.set(1, 1, 1);
  }
  node_soil_2.userData.sculptComponent = {"id": "soil", "name": "soil-mulch", "level": "macro", "primitive": "cylinder", "parent": "pot", "topologyClass": "surface-relief", "topologyRationale": "바크칩 멀칭 상면 — 낮은 원판 근사(크롭 확인)", "material": "soil-mulch", "colorMaterialRecipe": {"dominantAlbedo": "rgba(46, 33, 25, 1)", "secondaryAlbedo": "rgba(66, 48, 34, 1)", "materialClass": "wood", "materialClassConfidence": 0.7}, "actionProfile": {"animatable": false, "pivot": {"ref": "origin"}}, "attachment": {"parentId": "pot", "parentSocket": "pot-rim-inner", "contactType": "embed", "localStart": [0, 0.255, 0], "localEnd": [0, 0.285, 0], "baseRadius": 0.132, "endRadius": 0.142, "embedDepth": 0.03, "gapTolerance": 0.003}};
  node_soil_2.userData.actionProfile = {"animatable": false, "pivot": {"ref": "origin"}};
  (nodes["pot"] ?? root).add(node_soil_2);
  nodes["soil"] = node_soil_2;
  const mesh_soil_2Geometry = endpoint_soil_2
    ? new THREE.CylinderGeometry(endpoint_soil_2.endRadius, endpoint_soil_2.baseRadius, endpoint_soil_2.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_soil_2 = new THREE.Mesh(
    mesh_soil_2Geometry,
    materialMap["soil-mulch"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_soil_2.name = "soil-mulch";
  if (endpoint_soil_2) {
    mesh_soil_2.position.copy(endpoint_soil_2.midpoint);
    mesh_soil_2.quaternion.copy(endpoint_soil_2.quaternion);
  }
  mesh_soil_2.castShadow = options.castShadow ?? true;
  mesh_soil_2.receiveShadow = options.receiveShadow ?? true;
  mesh_soil_2.userData.sculptComponent = {"id": "soil", "name": "soil-mulch", "level": "macro", "primitive": "cylinder", "parent": "pot", "topologyClass": "surface-relief", "topologyRationale": "바크칩 멀칭 상면 — 낮은 원판 근사(크롭 확인)", "material": "soil-mulch", "colorMaterialRecipe": {"dominantAlbedo": "rgba(46, 33, 25, 1)", "secondaryAlbedo": "rgba(66, 48, 34, 1)", "materialClass": "wood", "materialClassConfidence": 0.7}, "actionProfile": {"animatable": false, "pivot": {"ref": "origin"}}, "attachment": {"parentId": "pot", "parentSocket": "pot-rim-inner", "contactType": "embed", "localStart": [0, 0.255, 0], "localEnd": [0, 0.285, 0], "baseRadius": 0.132, "endRadius": 0.142, "embedDepth": 0.03, "gapTolerance": 0.003}};
  node_soil_2.add(mesh_soil_2);
  meshes["soil"] = mesh_soil_2;
  colliders["soil"] = {};

  const attachment_stem_3 = {"parentId": "soil", "parentSocket": "soil-center", "contactType": "embed", "localStart": [0, 0.005, 0], "localEnd": [-0.14, 0.7, 0.04], "baseRadius": 0.024, "endRadius": 0.014, "embedDepth": 0.05, "gapTolerance": 0.003};
  const endpoint_stem_3 = makeAttachmentEndpoint(attachment_stem_3);
  const node_stem_3 = new THREE.Group();
  node_stem_3.name = "main-stem__pivot";
  if (endpoint_stem_3) {
    node_stem_3.position.copy(endpoint_stem_3.start);
    node_stem_3.rotation.set(0, 0, 0);
    node_stem_3.scale.set(1, 1, 1);
  } else {
    node_stem_3.position.set(0, 0, 0);
    node_stem_3.rotation.set(0, 0, 0);
    node_stem_3.scale.set(1, 1, 1);
  }
  node_stem_3.userData.sculptComponent = {"id": "stem", "name": "main-stem", "level": "macro", "primitive": "tube", "parent": "soil", "topologyClass": "continuous-sculpt", "topologyRationale": "측방 ~30° 기운 단일 줄기 — 테이퍼 원기둥 근사", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(104, 128, 74, 1)", "secondaryAlbedo": "rgba(122, 106, 79, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "localFeatures": [{"id": "node-scars", "type": "surface-relief", "description": "마디 링"}, {"id": "stem-lean", "type": "proportion", "description": "~30° 기움"}, {"id": "cataphyll-sheath", "type": "silhouette", "description": "상부 마른 초엽"}], "attachment": {"parentId": "soil", "parentSocket": "soil-center", "contactType": "embed", "localStart": [0, 0.005, 0], "localEnd": [-0.14, 0.7, 0.04], "baseRadius": 0.024, "endRadius": 0.014, "embedDepth": 0.05, "gapTolerance": 0.003}};
  node_stem_3.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["soil"] ?? root).add(node_stem_3);
  nodes["stem"] = node_stem_3;
  const mesh_stem_3Geometry = endpoint_stem_3
    ? new THREE.CylinderGeometry(endpoint_stem_3.endRadius, endpoint_stem_3.baseRadius, endpoint_stem_3.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_stem_3 = new THREE.Mesh(
    mesh_stem_3Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_stem_3.name = "main-stem";
  if (endpoint_stem_3) {
    mesh_stem_3.position.copy(endpoint_stem_3.midpoint);
    mesh_stem_3.quaternion.copy(endpoint_stem_3.quaternion);
  }
  mesh_stem_3.castShadow = options.castShadow ?? true;
  mesh_stem_3.receiveShadow = options.receiveShadow ?? true;
  mesh_stem_3.userData.sculptComponent = {"id": "stem", "name": "main-stem", "level": "macro", "primitive": "tube", "parent": "soil", "topologyClass": "continuous-sculpt", "topologyRationale": "측방 ~30° 기운 단일 줄기 — 테이퍼 원기둥 근사", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(104, 128, 74, 1)", "secondaryAlbedo": "rgba(122, 106, 79, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "localFeatures": [{"id": "node-scars", "type": "surface-relief", "description": "마디 링"}, {"id": "stem-lean", "type": "proportion", "description": "~30° 기움"}, {"id": "cataphyll-sheath", "type": "silhouette", "description": "상부 마른 초엽"}], "attachment": {"parentId": "soil", "parentSocket": "soil-center", "contactType": "embed", "localStart": [0, 0.005, 0], "localEnd": [-0.14, 0.7, 0.04], "baseRadius": 0.024, "endRadius": 0.014, "embedDepth": 0.05, "gapTolerance": 0.003}};
  node_stem_3.add(mesh_stem_3);
  meshes["stem"] = mesh_stem_3;
  colliders["stem"] = {};

  const attachment_petiole_0_4 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.071, 0.294, 0.021], "localEnd": [-0.071, 0.454, 0.321], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_0_4 = makeAttachmentEndpoint(attachment_petiole_0_4);
  const node_petiole_0_4 = new THREE.Group();
  node_petiole_0_4.name = "petiole-0__pivot";
  if (endpoint_petiole_0_4) {
    node_petiole_0_4.position.copy(endpoint_petiole_0_4.start);
    node_petiole_0_4.rotation.set(0, 0, 0);
    node_petiole_0_4.scale.set(1, 1, 1);
  } else {
    node_petiole_0_4.position.set(0, 0, 0);
    node_petiole_0_4.rotation.set(0, 0, 0);
    node_petiole_0_4.scale.set(1, 1, 1);
  }
  node_petiole_0_4.userData.sculptComponent = {"id": "petiole-0", "name": "petiole-0", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.071, 0.294, 0.021], "localEnd": [-0.071, 0.454, 0.321], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_0_4.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_0_4);
  nodes["petiole-0"] = node_petiole_0_4;
  const mesh_petiole_0_4Geometry = endpoint_petiole_0_4
    ? new THREE.CylinderGeometry(endpoint_petiole_0_4.endRadius, endpoint_petiole_0_4.baseRadius, endpoint_petiole_0_4.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_0_4 = new THREE.Mesh(
    mesh_petiole_0_4Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_0_4.name = "petiole-0";
  if (endpoint_petiole_0_4) {
    mesh_petiole_0_4.position.copy(endpoint_petiole_0_4.midpoint);
    mesh_petiole_0_4.quaternion.copy(endpoint_petiole_0_4.quaternion);
  }
  mesh_petiole_0_4.castShadow = options.castShadow ?? true;
  mesh_petiole_0_4.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_0_4.userData.sculptComponent = {"id": "petiole-0", "name": "petiole-0", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.071, 0.294, 0.021], "localEnd": [-0.071, 0.454, 0.321], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_0_4.add(mesh_petiole_0_4);
  meshes["petiole-0"] = mesh_petiole_0_4;
  colliders["petiole-0"] = {};

  const attachment_lamina_0_5 = null;
  const endpoint_lamina_0_5 = makeAttachmentEndpoint(attachment_lamina_0_5);
  const node_lamina_0_5 = new THREE.Group();
  node_lamina_0_5.name = "leaf-lamina-0__pivot";
  if (endpoint_lamina_0_5) {
    node_lamina_0_5.position.copy(endpoint_lamina_0_5.start);
    node_lamina_0_5.rotation.set(0, 0, 0);
    node_lamina_0_5.scale.set(1, 1, 1);
  } else {
    node_lamina_0_5.position.set(0.0, 0.16, 0.3);
    node_lamina_0_5.rotation.set(-0.5, -1.571, 0.0);
    node_lamina_0_5.scale.set(1, 1, 1);
  }
  node_lamina_0_5.userData.sculptComponent = {"id": "lamina-0", "name": "leaf-lamina-0", "level": "macro", "primitive": "extrude", "parent": "petiole-0", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [0.0, 0.16, 0.3], "rotation": [-0.5, -1.571, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0166], [0.0174, -0.0156], [0.0344, -0.0126], [0.0509, -0.0077], [0.0665, -0.0008], [0.081, 0.0079], [0.0941, 0.0183], [0.1056, 0.0304], [0.1155, 0.0439], [0.1235, 0.0588], [0.1297, 0.0749], [0.134, 0.092], [0.1364, 0.1098], [0.137, 0.1283], [0.1359, 0.1473], [0.1331, 0.1664], [0.1285, 0.1855], [0.1096, 0.2045], [0.0609, 0.223], [0.0436, 0.2408], [0.0758, 0.2579], [0.0898, 0.274], [0.0824, 0.2889], [0.0725, 0.3024], [0.0624, 0.3145], [0.0521, 0.3249], [0.0418, 0.3336], [0.0314, 0.3405], [0.0209, 0.3454], [0.0105, 0.3484], [0.0, 0.3494], [-0.0105, 0.3484], [-0.0204, 0.3454], [-0.0265, 0.3405], [-0.0306, 0.3336], [-0.0447, 0.3249], [-0.0614, 0.3145], [-0.0725, 0.3024], [-0.0824, 0.2889], [-0.0919, 0.274], [-0.1009, 0.2579], [-0.1092, 0.2408], [-0.1168, 0.223], [-0.1234, 0.2045], [-0.1289, 0.1855], [-0.1331, 0.1664], [-0.1354, 0.1473], [-0.1216, 0.1283], [-0.0711, 0.1098], [-0.0534, 0.092], [-0.0975, 0.0749], [-0.1235, 0.0588], [-0.1155, 0.0439], [-0.1056, 0.0304], [-0.0941, 0.0183], [-0.081, 0.0079], [-0.0665, -0.0008], [-0.0509, -0.0077], [-0.0344, -0.0126], [-0.0174, -0.0156], [-0.0, -0.0166]], "depth": 0.004, "ovalHoles": [{"cx": 0.041600000000000005, "cy": 0.13312000000000002, "rx": 0.009984000000000002, "ry": 0.02496}, {"cx": -0.03744, "cy": 0.18304, "rx": 0.008320000000000001, "ry": 0.021632000000000002}]}}};
  node_lamina_0_5.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-0"] ?? root).add(node_lamina_0_5);
  nodes["lamina-0"] = node_lamina_0_5;
  const mesh_lamina_0_5Geometry = endpoint_lamina_0_5
    ? new THREE.CylinderGeometry(endpoint_lamina_0_5.endRadius, endpoint_lamina_0_5.baseRadius, endpoint_lamina_0_5.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0166], [0.0174, -0.0156], [0.0344, -0.0126], [0.0509, -0.0077], [0.0665, -0.0008], [0.081, 0.0079], [0.0941, 0.0183], [0.1056, 0.0304], [0.1155, 0.0439], [0.1235, 0.0588], [0.1297, 0.0749], [0.134, 0.092], [0.1364, 0.1098], [0.137, 0.1283], [0.1359, 0.1473], [0.1331, 0.1664], [0.1285, 0.1855], [0.1096, 0.2045], [0.0609, 0.223], [0.0436, 0.2408], [0.0758, 0.2579], [0.0898, 0.274], [0.0824, 0.2889], [0.0725, 0.3024], [0.0624, 0.3145], [0.0521, 0.3249], [0.0418, 0.3336], [0.0314, 0.3405], [0.0209, 0.3454], [0.0105, 0.3484], [0.0, 0.3494], [-0.0105, 0.3484], [-0.0204, 0.3454], [-0.0265, 0.3405], [-0.0306, 0.3336], [-0.0447, 0.3249], [-0.0614, 0.3145], [-0.0725, 0.3024], [-0.0824, 0.2889], [-0.0919, 0.274], [-0.1009, 0.2579], [-0.1092, 0.2408], [-0.1168, 0.223], [-0.1234, 0.2045], [-0.1289, 0.1855], [-0.1331, 0.1664], [-0.1354, 0.1473], [-0.1216, 0.1283], [-0.0711, 0.1098], [-0.0534, 0.092], [-0.0975, 0.0749], [-0.1235, 0.0588], [-0.1155, 0.0439], [-0.1056, 0.0304], [-0.0941, 0.0183], [-0.081, 0.0079], [-0.0665, -0.0008], [-0.0509, -0.0077], [-0.0344, -0.0126], [-0.0174, -0.0156], [-0.0, -0.0166]], "depth": 0.004, "ovalHoles": [{"cx": 0.041600000000000005, "cy": 0.13312000000000002, "rx": 0.009984000000000002, "ry": 0.02496}, {"cx": -0.03744, "cy": 0.18304, "rx": 0.008320000000000001, "ry": 0.021632000000000002}]});
  const mesh_lamina_0_5 = new THREE.Mesh(
    mesh_lamina_0_5Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_0_5.name = "leaf-lamina-0";
  if (endpoint_lamina_0_5) {
    mesh_lamina_0_5.position.copy(endpoint_lamina_0_5.midpoint);
    mesh_lamina_0_5.quaternion.copy(endpoint_lamina_0_5.quaternion);
  }
  mesh_lamina_0_5.castShadow = options.castShadow ?? true;
  mesh_lamina_0_5.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_0_5.userData.sculptComponent = {"id": "lamina-0", "name": "leaf-lamina-0", "level": "macro", "primitive": "extrude", "parent": "petiole-0", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [0.0, 0.16, 0.3], "rotation": [-0.5, -1.571, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0166], [0.0174, -0.0156], [0.0344, -0.0126], [0.0509, -0.0077], [0.0665, -0.0008], [0.081, 0.0079], [0.0941, 0.0183], [0.1056, 0.0304], [0.1155, 0.0439], [0.1235, 0.0588], [0.1297, 0.0749], [0.134, 0.092], [0.1364, 0.1098], [0.137, 0.1283], [0.1359, 0.1473], [0.1331, 0.1664], [0.1285, 0.1855], [0.1096, 0.2045], [0.0609, 0.223], [0.0436, 0.2408], [0.0758, 0.2579], [0.0898, 0.274], [0.0824, 0.2889], [0.0725, 0.3024], [0.0624, 0.3145], [0.0521, 0.3249], [0.0418, 0.3336], [0.0314, 0.3405], [0.0209, 0.3454], [0.0105, 0.3484], [0.0, 0.3494], [-0.0105, 0.3484], [-0.0204, 0.3454], [-0.0265, 0.3405], [-0.0306, 0.3336], [-0.0447, 0.3249], [-0.0614, 0.3145], [-0.0725, 0.3024], [-0.0824, 0.2889], [-0.0919, 0.274], [-0.1009, 0.2579], [-0.1092, 0.2408], [-0.1168, 0.223], [-0.1234, 0.2045], [-0.1289, 0.1855], [-0.1331, 0.1664], [-0.1354, 0.1473], [-0.1216, 0.1283], [-0.0711, 0.1098], [-0.0534, 0.092], [-0.0975, 0.0749], [-0.1235, 0.0588], [-0.1155, 0.0439], [-0.1056, 0.0304], [-0.0941, 0.0183], [-0.081, 0.0079], [-0.0665, -0.0008], [-0.0509, -0.0077], [-0.0344, -0.0126], [-0.0174, -0.0156], [-0.0, -0.0166]], "depth": 0.004, "ovalHoles": [{"cx": 0.041600000000000005, "cy": 0.13312000000000002, "rx": 0.009984000000000002, "ry": 0.02496}, {"cx": -0.03744, "cy": 0.18304, "rx": 0.008320000000000001, "ry": 0.021632000000000002}]}}};
  node_lamina_0_5.add(mesh_lamina_0_5);
  meshes["lamina-0"] = mesh_lamina_0_5;
  colliders["lamina-0"] = {};

  const attachment_petiole_1_6 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.137, 0.564, 0.04], "localEnd": [-0.365, 0.832, 0.326], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_1_6 = makeAttachmentEndpoint(attachment_petiole_1_6);
  const node_petiole_1_6 = new THREE.Group();
  node_petiole_1_6.name = "petiole-1__pivot";
  if (endpoint_petiole_1_6) {
    node_petiole_1_6.position.copy(endpoint_petiole_1_6.start);
    node_petiole_1_6.rotation.set(0, 0, 0);
    node_petiole_1_6.scale.set(1, 1, 1);
  } else {
    node_petiole_1_6.position.set(0, 0, 0);
    node_petiole_1_6.rotation.set(0, 0, 0);
    node_petiole_1_6.scale.set(1, 1, 1);
  }
  node_petiole_1_6.userData.sculptComponent = {"id": "petiole-1", "name": "petiole-1", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.137, 0.564, 0.04], "localEnd": [-0.365, 0.832, 0.326], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_1_6.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_1_6);
  nodes["petiole-1"] = node_petiole_1_6;
  const mesh_petiole_1_6Geometry = endpoint_petiole_1_6
    ? new THREE.CylinderGeometry(endpoint_petiole_1_6.endRadius, endpoint_petiole_1_6.baseRadius, endpoint_petiole_1_6.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_1_6 = new THREE.Mesh(
    mesh_petiole_1_6Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_1_6.name = "petiole-1";
  if (endpoint_petiole_1_6) {
    mesh_petiole_1_6.position.copy(endpoint_petiole_1_6.midpoint);
    mesh_petiole_1_6.quaternion.copy(endpoint_petiole_1_6.quaternion);
  }
  mesh_petiole_1_6.castShadow = options.castShadow ?? true;
  mesh_petiole_1_6.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_1_6.userData.sculptComponent = {"id": "petiole-1", "name": "petiole-1", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.137, 0.564, 0.04], "localEnd": [-0.365, 0.832, 0.326], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_1_6.add(mesh_petiole_1_6);
  meshes["petiole-1"] = mesh_petiole_1_6;
  colliders["petiole-1"] = {};

  const attachment_lamina_1_7 = null;
  const endpoint_lamina_1_7 = makeAttachmentEndpoint(attachment_lamina_1_7);
  const node_lamina_1_7 = new THREE.Group();
  node_lamina_1_7.name = "leaf-lamina-1__pivot";
  if (endpoint_lamina_1_7) {
    node_lamina_1_7.position.copy(endpoint_lamina_1_7.start);
    node_lamina_1_7.rotation.set(0, 0, 0);
    node_lamina_1_7.scale.set(1, 1, 1);
  } else {
    node_lamina_1_7.position.set(-0.228, 0.268, 0.286);
    node_lamina_1_7.rotation.set(-0.745, -2.243, 0.0);
    node_lamina_1_7.scale.set(1, 1, 1);
  }
  node_lamina_1_7.userData.sculptComponent = {"id": "lamina-1", "name": "leaf-lamina-1", "level": "macro", "primitive": "extrude", "parent": "petiole-1", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.228, 0.268, 0.286], "rotation": [-0.745, -2.243, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0136], [0.0142, -0.0127], [0.0281, -0.0103], [0.0415, -0.0063], [0.0542, -0.0007], [0.066, 0.0064], [0.0767, 0.0149], [0.0861, 0.0248], [0.0941, 0.0358], [0.1007, 0.0479], [0.1057, 0.061], [0.1092, 0.0749], [0.1111, 0.0895], [0.1116, 0.1046], [0.1107, 0.12], [0.1085, 0.1356], [0.1051, 0.1512], [0.1006, 0.1666], [0.0952, 0.1817], [0.089, 0.1963], [0.0822, 0.2102], [0.0748, 0.2233], [0.0657, 0.2354], [0.0516, 0.2464], [0.0358, 0.2563], [0.028, 0.2648], [0.0271, 0.2719], [0.024, 0.2775], [0.0169, 0.2815], [0.0085, 0.2839], [0.0, 0.2848], [-0.0085, 0.2839], [-0.017, 0.2815], [-0.0256, 0.2775], [-0.034, 0.2719], [-0.0425, 0.2648], [-0.0509, 0.2563], [-0.0591, 0.2464], [-0.0671, 0.2354], [-0.0749, 0.2233], [-0.0822, 0.2102], [-0.089, 0.1963], [-0.0927, 0.1817], [-0.0818, 0.1666], [-0.0525, 0.1512], [-0.0347, 0.1356], [-0.0553, 0.12], [-0.0908, 0.1046], [-0.1082, 0.0895], [-0.1091, 0.0749], [-0.1057, 0.061], [-0.1007, 0.0479], [-0.0941, 0.0358], [-0.0861, 0.0248], [-0.0767, 0.0149], [-0.066, 0.0064], [-0.0542, -0.0007], [-0.0415, -0.0063], [-0.0281, -0.0103], [-0.0142, -0.0127], [-0.0, -0.0136]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_1_7.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-1"] ?? root).add(node_lamina_1_7);
  nodes["lamina-1"] = node_lamina_1_7;
  const mesh_lamina_1_7Geometry = endpoint_lamina_1_7
    ? new THREE.CylinderGeometry(endpoint_lamina_1_7.endRadius, endpoint_lamina_1_7.baseRadius, endpoint_lamina_1_7.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0136], [0.0142, -0.0127], [0.0281, -0.0103], [0.0415, -0.0063], [0.0542, -0.0007], [0.066, 0.0064], [0.0767, 0.0149], [0.0861, 0.0248], [0.0941, 0.0358], [0.1007, 0.0479], [0.1057, 0.061], [0.1092, 0.0749], [0.1111, 0.0895], [0.1116, 0.1046], [0.1107, 0.12], [0.1085, 0.1356], [0.1051, 0.1512], [0.1006, 0.1666], [0.0952, 0.1817], [0.089, 0.1963], [0.0822, 0.2102], [0.0748, 0.2233], [0.0657, 0.2354], [0.0516, 0.2464], [0.0358, 0.2563], [0.028, 0.2648], [0.0271, 0.2719], [0.024, 0.2775], [0.0169, 0.2815], [0.0085, 0.2839], [0.0, 0.2848], [-0.0085, 0.2839], [-0.017, 0.2815], [-0.0256, 0.2775], [-0.034, 0.2719], [-0.0425, 0.2648], [-0.0509, 0.2563], [-0.0591, 0.2464], [-0.0671, 0.2354], [-0.0749, 0.2233], [-0.0822, 0.2102], [-0.089, 0.1963], [-0.0927, 0.1817], [-0.0818, 0.1666], [-0.0525, 0.1512], [-0.0347, 0.1356], [-0.0553, 0.12], [-0.0908, 0.1046], [-0.1082, 0.0895], [-0.1091, 0.0749], [-0.1057, 0.061], [-0.1007, 0.0479], [-0.0941, 0.0358], [-0.0861, 0.0248], [-0.0767, 0.0149], [-0.066, 0.0064], [-0.0542, -0.0007], [-0.0415, -0.0063], [-0.0281, -0.0103], [-0.0142, -0.0127], [-0.0, -0.0136]], "depth": 0.004, "ovalHoles": []});
  const mesh_lamina_1_7 = new THREE.Mesh(
    mesh_lamina_1_7Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_1_7.name = "leaf-lamina-1";
  if (endpoint_lamina_1_7) {
    mesh_lamina_1_7.position.copy(endpoint_lamina_1_7.midpoint);
    mesh_lamina_1_7.quaternion.copy(endpoint_lamina_1_7.quaternion);
  }
  mesh_lamina_1_7.castShadow = options.castShadow ?? true;
  mesh_lamina_1_7.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_1_7.userData.sculptComponent = {"id": "lamina-1", "name": "leaf-lamina-1", "level": "macro", "primitive": "extrude", "parent": "petiole-1", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.228, 0.268, 0.286], "rotation": [-0.745, -2.243, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0136], [0.0142, -0.0127], [0.0281, -0.0103], [0.0415, -0.0063], [0.0542, -0.0007], [0.066, 0.0064], [0.0767, 0.0149], [0.0861, 0.0248], [0.0941, 0.0358], [0.1007, 0.0479], [0.1057, 0.061], [0.1092, 0.0749], [0.1111, 0.0895], [0.1116, 0.1046], [0.1107, 0.12], [0.1085, 0.1356], [0.1051, 0.1512], [0.1006, 0.1666], [0.0952, 0.1817], [0.089, 0.1963], [0.0822, 0.2102], [0.0748, 0.2233], [0.0657, 0.2354], [0.0516, 0.2464], [0.0358, 0.2563], [0.028, 0.2648], [0.0271, 0.2719], [0.024, 0.2775], [0.0169, 0.2815], [0.0085, 0.2839], [0.0, 0.2848], [-0.0085, 0.2839], [-0.017, 0.2815], [-0.0256, 0.2775], [-0.034, 0.2719], [-0.0425, 0.2648], [-0.0509, 0.2563], [-0.0591, 0.2464], [-0.0671, 0.2354], [-0.0749, 0.2233], [-0.0822, 0.2102], [-0.089, 0.1963], [-0.0927, 0.1817], [-0.0818, 0.1666], [-0.0525, 0.1512], [-0.0347, 0.1356], [-0.0553, 0.12], [-0.0908, 0.1046], [-0.1082, 0.0895], [-0.1091, 0.0749], [-0.1057, 0.061], [-0.1007, 0.0479], [-0.0941, 0.0358], [-0.0861, 0.0248], [-0.0767, 0.0149], [-0.066, 0.0064], [-0.0542, -0.0007], [-0.0415, -0.0063], [-0.0281, -0.0103], [-0.0142, -0.0127], [-0.0, -0.0136]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_1_7.add(mesh_lamina_1_7);
  meshes["lamina-1"] = mesh_lamina_1_7;
  colliders["lamina-1"] = {};

  const attachment_petiole_2_8 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.109, 0.448, 0.032], "localEnd": [-0.529, 0.704, 0.129], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_2_8 = makeAttachmentEndpoint(attachment_petiole_2_8);
  const node_petiole_2_8 = new THREE.Group();
  node_petiole_2_8.name = "petiole-2__pivot";
  if (endpoint_petiole_2_8) {
    node_petiole_2_8.position.copy(endpoint_petiole_2_8.start);
    node_petiole_2_8.rotation.set(0, 0, 0);
    node_petiole_2_8.scale.set(1, 1, 1);
  } else {
    node_petiole_2_8.position.set(0, 0, 0);
    node_petiole_2_8.rotation.set(0, 0, 0);
    node_petiole_2_8.scale.set(1, 1, 1);
  }
  node_petiole_2_8.userData.sculptComponent = {"id": "petiole-2", "name": "petiole-2", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.109, 0.448, 0.032], "localEnd": [-0.529, 0.704, 0.129], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_2_8.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_2_8);
  nodes["petiole-2"] = node_petiole_2_8;
  const mesh_petiole_2_8Geometry = endpoint_petiole_2_8
    ? new THREE.CylinderGeometry(endpoint_petiole_2_8.endRadius, endpoint_petiole_2_8.baseRadius, endpoint_petiole_2_8.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_2_8 = new THREE.Mesh(
    mesh_petiole_2_8Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_2_8.name = "petiole-2";
  if (endpoint_petiole_2_8) {
    mesh_petiole_2_8.position.copy(endpoint_petiole_2_8.midpoint);
    mesh_petiole_2_8.quaternion.copy(endpoint_petiole_2_8.quaternion);
  }
  mesh_petiole_2_8.castShadow = options.castShadow ?? true;
  mesh_petiole_2_8.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_2_8.userData.sculptComponent = {"id": "petiole-2", "name": "petiole-2", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.109, 0.448, 0.032], "localEnd": [-0.529, 0.704, 0.129], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_2_8.add(mesh_petiole_2_8);
  meshes["petiole-2"] = mesh_petiole_2_8;
  colliders["petiole-2"] = {};

  const attachment_lamina_2_9 = null;
  const endpoint_lamina_2_9 = makeAttachmentEndpoint(attachment_lamina_2_9);
  const node_lamina_2_9 = new THREE.Group();
  node_lamina_2_9.name = "leaf-lamina-2__pivot";
  if (endpoint_lamina_2_9) {
    node_lamina_2_9.position.copy(endpoint_lamina_2_9.start);
    node_lamina_2_9.rotation.set(0, 0, 0);
    node_lamina_2_9.scale.set(1, 1, 1);
  } else {
    node_lamina_2_9.position.set(-0.42, 0.256, 0.097);
    node_lamina_2_9.rotation.set(-0.64, -2.915, 0.0);
    node_lamina_2_9.scale.set(1, 1, 1);
  }
  node_lamina_2_9.userData.sculptComponent = {"id": "lamina-2", "name": "leaf-lamina-2", "level": "macro", "primitive": "extrude", "parent": "petiole-2", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.42, 0.256, 0.097], "rotation": [-0.64, -2.915, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0149], [0.0155, -0.014], [0.0308, -0.0113], [0.0455, -0.0069], [0.0595, -0.0007], [0.0724, 0.007], [0.0841, 0.0164], [0.0945, 0.0272], [0.1033, 0.0393], [0.1105, 0.0526], [0.116, 0.067], [0.1198, 0.0822], [0.122, 0.0982], [0.1225, 0.1148], [0.1215, 0.1317], [0.119, 0.1488], [0.1153, 0.1659], [0.1104, 0.1828], [0.1045, 0.1994], [0.0977, 0.2154], [0.0902, 0.2306], [0.0821, 0.245], [0.0721, 0.2583], [0.0566, 0.2704], [0.0393, 0.2812], [0.0308, 0.2906], [0.0297, 0.2983], [0.0264, 0.3045], [0.0186, 0.3089], [0.0093, 0.3116], [0.0, 0.3125], [-0.0093, 0.3116], [-0.0187, 0.3089], [-0.028, 0.3045], [-0.0374, 0.2983], [-0.0466, 0.2906], [-0.0558, 0.2812], [-0.0649, 0.2704], [-0.0737, 0.2583], [-0.0822, 0.245], [-0.0902, 0.2306], [-0.0976, 0.2154], [-0.1017, 0.1994], [-0.0898, 0.1828], [-0.0576, 0.1659], [-0.0381, 0.1488], [-0.0607, 0.1317], [-0.0996, 0.1148], [-0.1187, 0.0982], [-0.1197, 0.0822], [-0.116, 0.067], [-0.1105, 0.0526], [-0.1033, 0.0393], [-0.0945, 0.0272], [-0.0841, 0.0164], [-0.0724, 0.007], [-0.0595, -0.0007], [-0.0455, -0.0069], [-0.0308, -0.0113], [-0.0155, -0.014], [-0.0, -0.0149]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_2_9.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-2"] ?? root).add(node_lamina_2_9);
  nodes["lamina-2"] = node_lamina_2_9;
  const mesh_lamina_2_9Geometry = endpoint_lamina_2_9
    ? new THREE.CylinderGeometry(endpoint_lamina_2_9.endRadius, endpoint_lamina_2_9.baseRadius, endpoint_lamina_2_9.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0149], [0.0155, -0.014], [0.0308, -0.0113], [0.0455, -0.0069], [0.0595, -0.0007], [0.0724, 0.007], [0.0841, 0.0164], [0.0945, 0.0272], [0.1033, 0.0393], [0.1105, 0.0526], [0.116, 0.067], [0.1198, 0.0822], [0.122, 0.0982], [0.1225, 0.1148], [0.1215, 0.1317], [0.119, 0.1488], [0.1153, 0.1659], [0.1104, 0.1828], [0.1045, 0.1994], [0.0977, 0.2154], [0.0902, 0.2306], [0.0821, 0.245], [0.0721, 0.2583], [0.0566, 0.2704], [0.0393, 0.2812], [0.0308, 0.2906], [0.0297, 0.2983], [0.0264, 0.3045], [0.0186, 0.3089], [0.0093, 0.3116], [0.0, 0.3125], [-0.0093, 0.3116], [-0.0187, 0.3089], [-0.028, 0.3045], [-0.0374, 0.2983], [-0.0466, 0.2906], [-0.0558, 0.2812], [-0.0649, 0.2704], [-0.0737, 0.2583], [-0.0822, 0.245], [-0.0902, 0.2306], [-0.0976, 0.2154], [-0.1017, 0.1994], [-0.0898, 0.1828], [-0.0576, 0.1659], [-0.0381, 0.1488], [-0.0607, 0.1317], [-0.0996, 0.1148], [-0.1187, 0.0982], [-0.1197, 0.0822], [-0.116, 0.067], [-0.1105, 0.0526], [-0.1033, 0.0393], [-0.0945, 0.0272], [-0.0841, 0.0164], [-0.0724, 0.007], [-0.0595, -0.0007], [-0.0455, -0.0069], [-0.0308, -0.0113], [-0.0155, -0.014], [-0.0, -0.0149]], "depth": 0.004, "ovalHoles": []});
  const mesh_lamina_2_9 = new THREE.Mesh(
    mesh_lamina_2_9Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_2_9.name = "leaf-lamina-2";
  if (endpoint_lamina_2_9) {
    mesh_lamina_2_9.position.copy(endpoint_lamina_2_9.midpoint);
    mesh_lamina_2_9.quaternion.copy(endpoint_lamina_2_9.quaternion);
  }
  mesh_lamina_2_9.castShadow = options.castShadow ?? true;
  mesh_lamina_2_9.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_2_9.userData.sculptComponent = {"id": "lamina-2", "name": "leaf-lamina-2", "level": "macro", "primitive": "extrude", "parent": "petiole-2", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.42, 0.256, 0.097], "rotation": [-0.64, -2.915, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0149], [0.0155, -0.014], [0.0308, -0.0113], [0.0455, -0.0069], [0.0595, -0.0007], [0.0724, 0.007], [0.0841, 0.0164], [0.0945, 0.0272], [0.1033, 0.0393], [0.1105, 0.0526], [0.116, 0.067], [0.1198, 0.0822], [0.122, 0.0982], [0.1225, 0.1148], [0.1215, 0.1317], [0.119, 0.1488], [0.1153, 0.1659], [0.1104, 0.1828], [0.1045, 0.1994], [0.0977, 0.2154], [0.0902, 0.2306], [0.0821, 0.245], [0.0721, 0.2583], [0.0566, 0.2704], [0.0393, 0.2812], [0.0308, 0.2906], [0.0297, 0.2983], [0.0264, 0.3045], [0.0186, 0.3089], [0.0093, 0.3116], [0.0, 0.3125], [-0.0093, 0.3116], [-0.0187, 0.3089], [-0.028, 0.3045], [-0.0374, 0.2983], [-0.0466, 0.2906], [-0.0558, 0.2812], [-0.0649, 0.2704], [-0.0737, 0.2583], [-0.0822, 0.245], [-0.0902, 0.2306], [-0.0976, 0.2154], [-0.1017, 0.1994], [-0.0898, 0.1828], [-0.0576, 0.1659], [-0.0381, 0.1488], [-0.0607, 0.1317], [-0.0996, 0.1148], [-0.1187, 0.0982], [-0.1197, 0.0822], [-0.116, 0.067], [-0.1105, 0.0526], [-0.1033, 0.0393], [-0.0945, 0.0272], [-0.0841, 0.0164], [-0.0724, 0.007], [-0.0595, -0.0007], [-0.0455, -0.0069], [-0.0308, -0.0113], [-0.0155, -0.014], [-0.0, -0.0149]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_2_9.add(mesh_lamina_2_9);
  meshes["lamina-2"] = mesh_lamina_2_9;
  colliders["lamina-2"] = {};

  const attachment_petiole_3_10 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.081, 0.332, 0.024], "localEnd": [-0.579, 0.577, 0.014], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_3_10 = makeAttachmentEndpoint(attachment_petiole_3_10);
  const node_petiole_3_10 = new THREE.Group();
  node_petiole_3_10.name = "petiole-3__pivot";
  if (endpoint_petiole_3_10) {
    node_petiole_3_10.position.copy(endpoint_petiole_3_10.start);
    node_petiole_3_10.rotation.set(0, 0, 0);
    node_petiole_3_10.scale.set(1, 1, 1);
  } else {
    node_petiole_3_10.position.set(0, 0, 0);
    node_petiole_3_10.rotation.set(0, 0, 0);
    node_petiole_3_10.scale.set(1, 1, 1);
  }
  node_petiole_3_10.userData.sculptComponent = {"id": "petiole-3", "name": "petiole-3", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.081, 0.332, 0.024], "localEnd": [-0.579, 0.577, 0.014], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_3_10.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_3_10);
  nodes["petiole-3"] = node_petiole_3_10;
  const mesh_petiole_3_10Geometry = endpoint_petiole_3_10
    ? new THREE.CylinderGeometry(endpoint_petiole_3_10.endRadius, endpoint_petiole_3_10.baseRadius, endpoint_petiole_3_10.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_3_10 = new THREE.Mesh(
    mesh_petiole_3_10Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_3_10.name = "petiole-3";
  if (endpoint_petiole_3_10) {
    mesh_petiole_3_10.position.copy(endpoint_petiole_3_10.midpoint);
    mesh_petiole_3_10.quaternion.copy(endpoint_petiole_3_10.quaternion);
  }
  mesh_petiole_3_10.castShadow = options.castShadow ?? true;
  mesh_petiole_3_10.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_3_10.userData.sculptComponent = {"id": "petiole-3", "name": "petiole-3", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.081, 0.332, 0.024], "localEnd": [-0.579, 0.577, 0.014], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_3_10.add(mesh_petiole_3_10);
  meshes["petiole-3"] = mesh_petiole_3_10;
  colliders["petiole-3"] = {};

  const attachment_lamina_3_11 = null;
  const endpoint_lamina_3_11 = makeAttachmentEndpoint(attachment_lamina_3_11);
  const node_lamina_3_11 = new THREE.Group();
  node_lamina_3_11.name = "leaf-lamina-3__pivot";
  if (endpoint_lamina_3_11) {
    node_lamina_3_11.position.copy(endpoint_lamina_3_11.start);
    node_lamina_3_11.rotation.set(0, 0, 0);
    node_lamina_3_11.scale.set(1, 1, 1);
  } else {
    node_lamina_3_11.position.set(-0.498, 0.244, -0.01);
    node_lamina_3_11.rotation.set(-0.535, -3.161, 0.0);
    node_lamina_3_11.scale.set(1, 1, 1);
  }
  node_lamina_3_11.userData.sculptComponent = {"id": "lamina-3", "name": "leaf-lamina-3", "level": "macro", "primitive": "extrude", "parent": "petiole-3", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.498, 0.244, -0.01], "rotation": [-0.535, -3.161, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0162], [0.0169, -0.0152], [0.0335, -0.0123], [0.0496, -0.0075], [0.0648, -0.0008], [0.0788, 0.0077], [0.0916, 0.0178], [0.1028, 0.0296], [0.1124, 0.0428], [0.1203, 0.0573], [0.1263, 0.0729], [0.1304, 0.0895], [0.1328, 0.1069], [0.1334, 0.125], [0.1323, 0.1434], [0.1296, 0.162], [0.1251, 0.1806], [0.1067, 0.199], [0.0593, 0.2171], [0.0424, 0.2345], [0.0738, 0.2511], [0.0874, 0.2667], [0.0802, 0.2812], [0.0706, 0.2944], [0.0608, 0.3062], [0.0508, 0.3163], [0.0407, 0.3248], [0.0305, 0.3315], [0.0204, 0.3363], [0.0102, 0.3392], [0.0, 0.3402], [-0.0102, 0.3392], [-0.0199, 0.3363], [-0.0258, 0.3315], [-0.0298, 0.3248], [-0.0435, 0.3163], [-0.0598, 0.3062], [-0.0706, 0.2944], [-0.0802, 0.2812], [-0.0894, 0.2667], [-0.0982, 0.2511], [-0.1064, 0.2345], [-0.1137, 0.2171], [-0.1202, 0.199], [-0.1255, 0.1806], [-0.1296, 0.162], [-0.1319, 0.1434], [-0.1184, 0.125], [-0.0692, 0.1069], [-0.052, 0.0895], [-0.0949, 0.0729], [-0.1203, 0.0573], [-0.1124, 0.0428], [-0.1028, 0.0296], [-0.0916, 0.0178], [-0.0788, 0.0077], [-0.0648, -0.0008], [-0.0496, -0.0075], [-0.0335, -0.0123], [-0.0169, -0.0152], [-0.0, -0.0162]], "depth": 0.004, "ovalHoles": [{"cx": 0.04050000000000001, "cy": 0.12960000000000002, "rx": 0.009720000000000001, "ry": 0.024300000000000002}, {"cx": -0.03645, "cy": 0.17820000000000003, "rx": 0.008100000000000001, "ry": 0.02106}]}}};
  node_lamina_3_11.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-3"] ?? root).add(node_lamina_3_11);
  nodes["lamina-3"] = node_lamina_3_11;
  const mesh_lamina_3_11Geometry = endpoint_lamina_3_11
    ? new THREE.CylinderGeometry(endpoint_lamina_3_11.endRadius, endpoint_lamina_3_11.baseRadius, endpoint_lamina_3_11.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0162], [0.0169, -0.0152], [0.0335, -0.0123], [0.0496, -0.0075], [0.0648, -0.0008], [0.0788, 0.0077], [0.0916, 0.0178], [0.1028, 0.0296], [0.1124, 0.0428], [0.1203, 0.0573], [0.1263, 0.0729], [0.1304, 0.0895], [0.1328, 0.1069], [0.1334, 0.125], [0.1323, 0.1434], [0.1296, 0.162], [0.1251, 0.1806], [0.1067, 0.199], [0.0593, 0.2171], [0.0424, 0.2345], [0.0738, 0.2511], [0.0874, 0.2667], [0.0802, 0.2812], [0.0706, 0.2944], [0.0608, 0.3062], [0.0508, 0.3163], [0.0407, 0.3248], [0.0305, 0.3315], [0.0204, 0.3363], [0.0102, 0.3392], [0.0, 0.3402], [-0.0102, 0.3392], [-0.0199, 0.3363], [-0.0258, 0.3315], [-0.0298, 0.3248], [-0.0435, 0.3163], [-0.0598, 0.3062], [-0.0706, 0.2944], [-0.0802, 0.2812], [-0.0894, 0.2667], [-0.0982, 0.2511], [-0.1064, 0.2345], [-0.1137, 0.2171], [-0.1202, 0.199], [-0.1255, 0.1806], [-0.1296, 0.162], [-0.1319, 0.1434], [-0.1184, 0.125], [-0.0692, 0.1069], [-0.052, 0.0895], [-0.0949, 0.0729], [-0.1203, 0.0573], [-0.1124, 0.0428], [-0.1028, 0.0296], [-0.0916, 0.0178], [-0.0788, 0.0077], [-0.0648, -0.0008], [-0.0496, -0.0075], [-0.0335, -0.0123], [-0.0169, -0.0152], [-0.0, -0.0162]], "depth": 0.004, "ovalHoles": [{"cx": 0.04050000000000001, "cy": 0.12960000000000002, "rx": 0.009720000000000001, "ry": 0.024300000000000002}, {"cx": -0.03645, "cy": 0.17820000000000003, "rx": 0.008100000000000001, "ry": 0.02106}]});
  const mesh_lamina_3_11 = new THREE.Mesh(
    mesh_lamina_3_11Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_3_11.name = "leaf-lamina-3";
  if (endpoint_lamina_3_11) {
    mesh_lamina_3_11.position.copy(endpoint_lamina_3_11.midpoint);
    mesh_lamina_3_11.quaternion.copy(endpoint_lamina_3_11.quaternion);
  }
  mesh_lamina_3_11.castShadow = options.castShadow ?? true;
  mesh_lamina_3_11.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_3_11.userData.sculptComponent = {"id": "lamina-3", "name": "leaf-lamina-3", "level": "macro", "primitive": "extrude", "parent": "petiole-3", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.498, 0.244, -0.01], "rotation": [-0.535, -3.161, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0162], [0.0169, -0.0152], [0.0335, -0.0123], [0.0496, -0.0075], [0.0648, -0.0008], [0.0788, 0.0077], [0.0916, 0.0178], [0.1028, 0.0296], [0.1124, 0.0428], [0.1203, 0.0573], [0.1263, 0.0729], [0.1304, 0.0895], [0.1328, 0.1069], [0.1334, 0.125], [0.1323, 0.1434], [0.1296, 0.162], [0.1251, 0.1806], [0.1067, 0.199], [0.0593, 0.2171], [0.0424, 0.2345], [0.0738, 0.2511], [0.0874, 0.2667], [0.0802, 0.2812], [0.0706, 0.2944], [0.0608, 0.3062], [0.0508, 0.3163], [0.0407, 0.3248], [0.0305, 0.3315], [0.0204, 0.3363], [0.0102, 0.3392], [0.0, 0.3402], [-0.0102, 0.3392], [-0.0199, 0.3363], [-0.0258, 0.3315], [-0.0298, 0.3248], [-0.0435, 0.3163], [-0.0598, 0.3062], [-0.0706, 0.2944], [-0.0802, 0.2812], [-0.0894, 0.2667], [-0.0982, 0.2511], [-0.1064, 0.2345], [-0.1137, 0.2171], [-0.1202, 0.199], [-0.1255, 0.1806], [-0.1296, 0.162], [-0.1319, 0.1434], [-0.1184, 0.125], [-0.0692, 0.1069], [-0.052, 0.0895], [-0.0949, 0.0729], [-0.1203, 0.0573], [-0.1124, 0.0428], [-0.1028, 0.0296], [-0.0916, 0.0178], [-0.0788, 0.0077], [-0.0648, -0.0008], [-0.0496, -0.0075], [-0.0335, -0.0123], [-0.0169, -0.0152], [-0.0, -0.0162]], "depth": 0.004, "ovalHoles": [{"cx": 0.04050000000000001, "cy": 0.12960000000000002, "rx": 0.009720000000000001, "ry": 0.024300000000000002}, {"cx": -0.03645, "cy": 0.17820000000000003, "rx": 0.008100000000000001, "ry": 0.02106}]}}};
  node_lamina_3_11.add(mesh_lamina_3_11);
  meshes["lamina-3"] = mesh_lamina_3_11;
  colliders["lamina-3"] = {};

  const attachment_petiole_4_12 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.146, 0.602, 0.043], "localEnd": [-0.411, 0.834, -0.176], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_4_12 = makeAttachmentEndpoint(attachment_petiole_4_12);
  const node_petiole_4_12 = new THREE.Group();
  node_petiole_4_12.name = "petiole-4__pivot";
  if (endpoint_petiole_4_12) {
    node_petiole_4_12.position.copy(endpoint_petiole_4_12.start);
    node_petiole_4_12.rotation.set(0, 0, 0);
    node_petiole_4_12.scale.set(1, 1, 1);
  } else {
    node_petiole_4_12.position.set(0, 0, 0);
    node_petiole_4_12.rotation.set(0, 0, 0);
    node_petiole_4_12.scale.set(1, 1, 1);
  }
  node_petiole_4_12.userData.sculptComponent = {"id": "petiole-4", "name": "petiole-4", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.146, 0.602, 0.043], "localEnd": [-0.411, 0.834, -0.176], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_4_12.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_4_12);
  nodes["petiole-4"] = node_petiole_4_12;
  const mesh_petiole_4_12Geometry = endpoint_petiole_4_12
    ? new THREE.CylinderGeometry(endpoint_petiole_4_12.endRadius, endpoint_petiole_4_12.baseRadius, endpoint_petiole_4_12.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_4_12 = new THREE.Mesh(
    mesh_petiole_4_12Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_4_12.name = "petiole-4";
  if (endpoint_petiole_4_12) {
    mesh_petiole_4_12.position.copy(endpoint_petiole_4_12.midpoint);
    mesh_petiole_4_12.quaternion.copy(endpoint_petiole_4_12.quaternion);
  }
  mesh_petiole_4_12.castShadow = options.castShadow ?? true;
  mesh_petiole_4_12.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_4_12.userData.sculptComponent = {"id": "petiole-4", "name": "petiole-4", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.146, 0.602, 0.043], "localEnd": [-0.411, 0.834, -0.176], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_4_12.add(mesh_petiole_4_12);
  meshes["petiole-4"] = mesh_petiole_4_12;
  colliders["petiole-4"] = {};

  const attachment_lamina_4_13 = null;
  const endpoint_lamina_4_13 = makeAttachmentEndpoint(attachment_lamina_4_13);
  const node_lamina_4_13 = new THREE.Group();
  node_lamina_4_13.name = "leaf-lamina-4__pivot";
  if (endpoint_lamina_4_13) {
    node_lamina_4_13.position.copy(endpoint_lamina_4_13.start);
    node_lamina_4_13.rotation.set(0, 0, 0);
    node_lamina_4_13.scale.set(1, 1, 1);
  } else {
    node_lamina_4_13.position.set(-0.265, 0.232, -0.219);
    node_lamina_4_13.rotation.set(-0.78, -3.833, 0.0);
    node_lamina_4_13.scale.set(1, 1, 1);
  }
  node_lamina_4_13.userData.sculptComponent = {"id": "lamina-4", "name": "leaf-lamina-4", "level": "macro", "primitive": "extrude", "parent": "petiole-4", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.265, 0.232, -0.219], "rotation": [-0.78, -3.833, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0131], [0.0137, -0.0123], [0.0272, -0.01], [0.0401, -0.0061], [0.0524, -0.0006], [0.0638, 0.0062], [0.0742, 0.0144], [0.0833, 0.0239], [0.091, 0.0346], [0.0974, 0.0464], [0.1023, 0.059], [0.1056, 0.0725], [0.1075, 0.0866], [0.108, 0.1012], [0.1071, 0.1161], [0.105, 0.1312], [0.1017, 0.1463], [0.0973, 0.1612], [0.0921, 0.1758], [0.0861, 0.1899], [0.0795, 0.2034], [0.0724, 0.216], [0.0636, 0.2278], [0.0499, 0.2385], [0.0347, 0.248], [0.0271, 0.2562], [0.0262, 0.263], [0.0233, 0.2685], [0.0164, 0.2724], [0.0082, 0.2747], [0.0, 0.2755], [-0.0082, 0.2747], [-0.0165, 0.2724], [-0.0247, 0.2685], [-0.0329, 0.263], [-0.0411, 0.2562], [-0.0492, 0.248], [-0.0572, 0.2385], [-0.065, 0.2278], [-0.0724, 0.216], [-0.0795, 0.2034], [-0.0861, 0.1899], [-0.0897, 0.1758], [-0.0792, 0.1612], [-0.0508, 0.1463], [-0.0336, 0.1312], [-0.0535, 0.1161], [-0.0879, 0.1012], [-0.1047, 0.0866], [-0.1056, 0.0725], [-0.1023, 0.059], [-0.0974, 0.0464], [-0.091, 0.0346], [-0.0833, 0.0239], [-0.0742, 0.0144], [-0.0638, 0.0062], [-0.0524, -0.0006], [-0.0401, -0.0061], [-0.0272, -0.01], [-0.0137, -0.0123], [-0.0, -0.0131]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_4_13.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-4"] ?? root).add(node_lamina_4_13);
  nodes["lamina-4"] = node_lamina_4_13;
  const mesh_lamina_4_13Geometry = endpoint_lamina_4_13
    ? new THREE.CylinderGeometry(endpoint_lamina_4_13.endRadius, endpoint_lamina_4_13.baseRadius, endpoint_lamina_4_13.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0131], [0.0137, -0.0123], [0.0272, -0.01], [0.0401, -0.0061], [0.0524, -0.0006], [0.0638, 0.0062], [0.0742, 0.0144], [0.0833, 0.0239], [0.091, 0.0346], [0.0974, 0.0464], [0.1023, 0.059], [0.1056, 0.0725], [0.1075, 0.0866], [0.108, 0.1012], [0.1071, 0.1161], [0.105, 0.1312], [0.1017, 0.1463], [0.0973, 0.1612], [0.0921, 0.1758], [0.0861, 0.1899], [0.0795, 0.2034], [0.0724, 0.216], [0.0636, 0.2278], [0.0499, 0.2385], [0.0347, 0.248], [0.0271, 0.2562], [0.0262, 0.263], [0.0233, 0.2685], [0.0164, 0.2724], [0.0082, 0.2747], [0.0, 0.2755], [-0.0082, 0.2747], [-0.0165, 0.2724], [-0.0247, 0.2685], [-0.0329, 0.263], [-0.0411, 0.2562], [-0.0492, 0.248], [-0.0572, 0.2385], [-0.065, 0.2278], [-0.0724, 0.216], [-0.0795, 0.2034], [-0.0861, 0.1899], [-0.0897, 0.1758], [-0.0792, 0.1612], [-0.0508, 0.1463], [-0.0336, 0.1312], [-0.0535, 0.1161], [-0.0879, 0.1012], [-0.1047, 0.0866], [-0.1056, 0.0725], [-0.1023, 0.059], [-0.0974, 0.0464], [-0.091, 0.0346], [-0.0833, 0.0239], [-0.0742, 0.0144], [-0.0638, 0.0062], [-0.0524, -0.0006], [-0.0401, -0.0061], [-0.0272, -0.01], [-0.0137, -0.0123], [-0.0, -0.0131]], "depth": 0.004, "ovalHoles": []});
  const mesh_lamina_4_13 = new THREE.Mesh(
    mesh_lamina_4_13Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_4_13.name = "leaf-lamina-4";
  if (endpoint_lamina_4_13) {
    mesh_lamina_4_13.position.copy(endpoint_lamina_4_13.midpoint);
    mesh_lamina_4_13.quaternion.copy(endpoint_lamina_4_13.quaternion);
  }
  mesh_lamina_4_13.castShadow = options.castShadow ?? true;
  mesh_lamina_4_13.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_4_13.userData.sculptComponent = {"id": "lamina-4", "name": "leaf-lamina-4", "level": "macro", "primitive": "extrude", "parent": "petiole-4", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.265, 0.232, -0.219], "rotation": [-0.78, -3.833, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0131], [0.0137, -0.0123], [0.0272, -0.01], [0.0401, -0.0061], [0.0524, -0.0006], [0.0638, 0.0062], [0.0742, 0.0144], [0.0833, 0.0239], [0.091, 0.0346], [0.0974, 0.0464], [0.1023, 0.059], [0.1056, 0.0725], [0.1075, 0.0866], [0.108, 0.1012], [0.1071, 0.1161], [0.105, 0.1312], [0.1017, 0.1463], [0.0973, 0.1612], [0.0921, 0.1758], [0.0861, 0.1899], [0.0795, 0.2034], [0.0724, 0.216], [0.0636, 0.2278], [0.0499, 0.2385], [0.0347, 0.248], [0.0271, 0.2562], [0.0262, 0.263], [0.0233, 0.2685], [0.0164, 0.2724], [0.0082, 0.2747], [0.0, 0.2755], [-0.0082, 0.2747], [-0.0165, 0.2724], [-0.0247, 0.2685], [-0.0329, 0.263], [-0.0411, 0.2562], [-0.0492, 0.248], [-0.0572, 0.2385], [-0.065, 0.2278], [-0.0724, 0.216], [-0.0795, 0.2034], [-0.0861, 0.1899], [-0.0897, 0.1758], [-0.0792, 0.1612], [-0.0508, 0.1463], [-0.0336, 0.1312], [-0.0535, 0.1161], [-0.0879, 0.1012], [-0.1047, 0.0866], [-0.1056, 0.0725], [-0.1023, 0.059], [-0.0974, 0.0464], [-0.091, 0.0346], [-0.0833, 0.0239], [-0.0742, 0.0144], [-0.0638, 0.0062], [-0.0524, -0.0006], [-0.0401, -0.0061], [-0.0272, -0.01], [-0.0137, -0.0123], [-0.0, -0.0131]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_4_13.add(mesh_lamina_4_13);
  meshes["lamina-4"] = mesh_lamina_4_13;
  colliders["lamina-4"] = {};

  const attachment_petiole_5_14 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.118, 0.486, 0.035], "localEnd": [-0.202, 0.707, -0.366], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_5_14 = makeAttachmentEndpoint(attachment_petiole_5_14);
  const node_petiole_5_14 = new THREE.Group();
  node_petiole_5_14.name = "petiole-5__pivot";
  if (endpoint_petiole_5_14) {
    node_petiole_5_14.position.copy(endpoint_petiole_5_14.start);
    node_petiole_5_14.rotation.set(0, 0, 0);
    node_petiole_5_14.scale.set(1, 1, 1);
  } else {
    node_petiole_5_14.position.set(0, 0, 0);
    node_petiole_5_14.rotation.set(0, 0, 0);
    node_petiole_5_14.scale.set(1, 1, 1);
  }
  node_petiole_5_14.userData.sculptComponent = {"id": "petiole-5", "name": "petiole-5", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.118, 0.486, 0.035], "localEnd": [-0.202, 0.707, -0.366], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_5_14.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_5_14);
  nodes["petiole-5"] = node_petiole_5_14;
  const mesh_petiole_5_14Geometry = endpoint_petiole_5_14
    ? new THREE.CylinderGeometry(endpoint_petiole_5_14.endRadius, endpoint_petiole_5_14.baseRadius, endpoint_petiole_5_14.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_5_14 = new THREE.Mesh(
    mesh_petiole_5_14Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_5_14.name = "petiole-5";
  if (endpoint_petiole_5_14) {
    mesh_petiole_5_14.position.copy(endpoint_petiole_5_14.midpoint);
    mesh_petiole_5_14.quaternion.copy(endpoint_petiole_5_14.quaternion);
  }
  mesh_petiole_5_14.castShadow = options.castShadow ?? true;
  mesh_petiole_5_14.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_5_14.userData.sculptComponent = {"id": "petiole-5", "name": "petiole-5", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.118, 0.486, 0.035], "localEnd": [-0.202, 0.707, -0.366], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_5_14.add(mesh_petiole_5_14);
  meshes["petiole-5"] = mesh_petiole_5_14;
  colliders["petiole-5"] = {};

  const attachment_lamina_5_15 = null;
  const endpoint_lamina_5_15 = makeAttachmentEndpoint(attachment_lamina_5_15);
  const node_lamina_5_15 = new THREE.Group();
  node_lamina_5_15.name = "leaf-lamina-5__pivot";
  if (endpoint_lamina_5_15) {
    node_lamina_5_15.position.copy(endpoint_lamina_5_15.start);
    node_lamina_5_15.rotation.set(0, 0, 0);
    node_lamina_5_15.scale.set(1, 1, 1);
  } else {
    node_lamina_5_15.position.set(-0.084, 0.22, -0.401);
    node_lamina_5_15.rotation.set(-0.675, -4.505, 0.0);
    node_lamina_5_15.scale.set(1, 1, 1);
  }
  node_lamina_5_15.userData.sculptComponent = {"id": "lamina-5", "name": "leaf-lamina-5", "level": "macro", "primitive": "extrude", "parent": "petiole-5", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.084, 0.22, -0.401], "rotation": [-0.675, -4.505, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0144], [0.0151, -0.0136], [0.0299, -0.011], [0.0442, -0.0067], [0.0577, -0.0007], [0.0703, 0.0068], [0.0816, 0.0159], [0.0917, 0.0264], [0.1002, 0.0381], [0.1072, 0.051], [0.1125, 0.065], [0.1163, 0.0798], [0.1184, 0.0953], [0.1189, 0.1114], [0.1179, 0.1278], [0.1155, 0.1444], [0.1119, 0.161], [0.1071, 0.1774], [0.1014, 0.1935], [0.0948, 0.209], [0.0875, 0.2238], [0.0797, 0.2378], [0.07, 0.2507], [0.0549, 0.2624], [0.0381, 0.2729], [0.0299, 0.282], [0.0288, 0.2895], [0.0256, 0.2955], [0.018, 0.2998], [0.0091, 0.3024], [0.0, 0.3032], [-0.0091, 0.3024], [-0.0181, 0.2998], [-0.0272, 0.2955], [-0.0363, 0.2895], [-0.0453, 0.282], [-0.0542, 0.2729], [-0.0629, 0.2624], [-0.0715, 0.2507], [-0.0797, 0.2378], [-0.0875, 0.2238], [-0.0948, 0.209], [-0.0987, 0.1935], [-0.0871, 0.1774], [-0.0559, 0.161], [-0.037, 0.1444], [-0.0589, 0.1278], [-0.0967, 0.1114], [-0.1152, 0.0953], [-0.1162, 0.0798], [-0.1125, 0.065], [-0.1072, 0.051], [-0.1002, 0.0381], [-0.0917, 0.0264], [-0.0816, 0.0159], [-0.0703, 0.0068], [-0.0577, -0.0007], [-0.0442, -0.0067], [-0.0299, -0.011], [-0.0151, -0.0136], [-0.0, -0.0144]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_5_15.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-5"] ?? root).add(node_lamina_5_15);
  nodes["lamina-5"] = node_lamina_5_15;
  const mesh_lamina_5_15Geometry = endpoint_lamina_5_15
    ? new THREE.CylinderGeometry(endpoint_lamina_5_15.endRadius, endpoint_lamina_5_15.baseRadius, endpoint_lamina_5_15.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0144], [0.0151, -0.0136], [0.0299, -0.011], [0.0442, -0.0067], [0.0577, -0.0007], [0.0703, 0.0068], [0.0816, 0.0159], [0.0917, 0.0264], [0.1002, 0.0381], [0.1072, 0.051], [0.1125, 0.065], [0.1163, 0.0798], [0.1184, 0.0953], [0.1189, 0.1114], [0.1179, 0.1278], [0.1155, 0.1444], [0.1119, 0.161], [0.1071, 0.1774], [0.1014, 0.1935], [0.0948, 0.209], [0.0875, 0.2238], [0.0797, 0.2378], [0.07, 0.2507], [0.0549, 0.2624], [0.0381, 0.2729], [0.0299, 0.282], [0.0288, 0.2895], [0.0256, 0.2955], [0.018, 0.2998], [0.0091, 0.3024], [0.0, 0.3032], [-0.0091, 0.3024], [-0.0181, 0.2998], [-0.0272, 0.2955], [-0.0363, 0.2895], [-0.0453, 0.282], [-0.0542, 0.2729], [-0.0629, 0.2624], [-0.0715, 0.2507], [-0.0797, 0.2378], [-0.0875, 0.2238], [-0.0948, 0.209], [-0.0987, 0.1935], [-0.0871, 0.1774], [-0.0559, 0.161], [-0.037, 0.1444], [-0.0589, 0.1278], [-0.0967, 0.1114], [-0.1152, 0.0953], [-0.1162, 0.0798], [-0.1125, 0.065], [-0.1072, 0.051], [-0.1002, 0.0381], [-0.0917, 0.0264], [-0.0816, 0.0159], [-0.0703, 0.0068], [-0.0577, -0.0007], [-0.0442, -0.0067], [-0.0299, -0.011], [-0.0151, -0.0136], [-0.0, -0.0144]], "depth": 0.004, "ovalHoles": []});
  const mesh_lamina_5_15 = new THREE.Mesh(
    mesh_lamina_5_15Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_5_15.name = "leaf-lamina-5";
  if (endpoint_lamina_5_15) {
    mesh_lamina_5_15.position.copy(endpoint_lamina_5_15.midpoint);
    mesh_lamina_5_15.quaternion.copy(endpoint_lamina_5_15.quaternion);
  }
  mesh_lamina_5_15.castShadow = options.castShadow ?? true;
  mesh_lamina_5_15.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_5_15.userData.sculptComponent = {"id": "lamina-5", "name": "leaf-lamina-5", "level": "macro", "primitive": "extrude", "parent": "petiole-5", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [-0.084, 0.22, -0.401], "rotation": [-0.675, -4.505, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0144], [0.0151, -0.0136], [0.0299, -0.011], [0.0442, -0.0067], [0.0577, -0.0007], [0.0703, 0.0068], [0.0816, 0.0159], [0.0917, 0.0264], [0.1002, 0.0381], [0.1072, 0.051], [0.1125, 0.065], [0.1163, 0.0798], [0.1184, 0.0953], [0.1189, 0.1114], [0.1179, 0.1278], [0.1155, 0.1444], [0.1119, 0.161], [0.1071, 0.1774], [0.1014, 0.1935], [0.0948, 0.209], [0.0875, 0.2238], [0.0797, 0.2378], [0.07, 0.2507], [0.0549, 0.2624], [0.0381, 0.2729], [0.0299, 0.282], [0.0288, 0.2895], [0.0256, 0.2955], [0.018, 0.2998], [0.0091, 0.3024], [0.0, 0.3032], [-0.0091, 0.3024], [-0.0181, 0.2998], [-0.0272, 0.2955], [-0.0363, 0.2895], [-0.0453, 0.282], [-0.0542, 0.2729], [-0.0629, 0.2624], [-0.0715, 0.2507], [-0.0797, 0.2378], [-0.0875, 0.2238], [-0.0948, 0.209], [-0.0987, 0.1935], [-0.0871, 0.1774], [-0.0559, 0.161], [-0.037, 0.1444], [-0.0589, 0.1278], [-0.0967, 0.1114], [-0.1152, 0.0953], [-0.1162, 0.0798], [-0.1125, 0.065], [-0.1072, 0.051], [-0.1002, 0.0381], [-0.0917, 0.0264], [-0.0816, 0.0159], [-0.0703, 0.0068], [-0.0577, -0.0007], [-0.0442, -0.0067], [-0.0299, -0.011], [-0.0151, -0.0136], [-0.0, -0.0144]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_5_15.add(mesh_lamina_5_15);
  meshes["lamina-5"] = mesh_lamina_5_15;
  colliders["lamina-5"] = {};

  const attachment_petiole_6_16 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.09, 0.371, 0.027], "localEnd": [-0.071, 0.579, -0.449], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_6_16 = makeAttachmentEndpoint(attachment_petiole_6_16);
  const node_petiole_6_16 = new THREE.Group();
  node_petiole_6_16.name = "petiole-6__pivot";
  if (endpoint_petiole_6_16) {
    node_petiole_6_16.position.copy(endpoint_petiole_6_16.start);
    node_petiole_6_16.rotation.set(0, 0, 0);
    node_petiole_6_16.scale.set(1, 1, 1);
  } else {
    node_petiole_6_16.position.set(0, 0, 0);
    node_petiole_6_16.rotation.set(0, 0, 0);
    node_petiole_6_16.scale.set(1, 1, 1);
  }
  node_petiole_6_16.userData.sculptComponent = {"id": "petiole-6", "name": "petiole-6", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.09, 0.371, 0.027], "localEnd": [-0.071, 0.579, -0.449], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_6_16.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_6_16);
  nodes["petiole-6"] = node_petiole_6_16;
  const mesh_petiole_6_16Geometry = endpoint_petiole_6_16
    ? new THREE.CylinderGeometry(endpoint_petiole_6_16.endRadius, endpoint_petiole_6_16.baseRadius, endpoint_petiole_6_16.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_6_16 = new THREE.Mesh(
    mesh_petiole_6_16Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_6_16.name = "petiole-6";
  if (endpoint_petiole_6_16) {
    mesh_petiole_6_16.position.copy(endpoint_petiole_6_16.midpoint);
    mesh_petiole_6_16.quaternion.copy(endpoint_petiole_6_16.quaternion);
  }
  mesh_petiole_6_16.castShadow = options.castShadow ?? true;
  mesh_petiole_6_16.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_6_16.userData.sculptComponent = {"id": "petiole-6", "name": "petiole-6", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.09, 0.371, 0.027], "localEnd": [-0.071, 0.579, -0.449], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_6_16.add(mesh_petiole_6_16);
  meshes["petiole-6"] = mesh_petiole_6_16;
  colliders["petiole-6"] = {};

  const attachment_lamina_6_17 = null;
  const endpoint_lamina_6_17 = makeAttachmentEndpoint(attachment_lamina_6_17);
  const node_lamina_6_17 = new THREE.Group();
  node_lamina_6_17.name = "leaf-lamina-6__pivot";
  if (endpoint_lamina_6_17) {
    node_lamina_6_17.position.copy(endpoint_lamina_6_17.start);
    node_lamina_6_17.rotation.set(0, 0, 0);
    node_lamina_6_17.scale.set(1, 1, 1);
  } else {
    node_lamina_6_17.position.set(0.019, 0.208, -0.476);
    node_lamina_6_17.rotation.set(-0.57, -4.752, 0.0);
    node_lamina_6_17.scale.set(1, 1, 1);
  }
  node_lamina_6_17.userData.sculptComponent = {"id": "lamina-6", "name": "leaf-lamina-6", "level": "macro", "primitive": "extrude", "parent": "petiole-6", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [0.019, 0.208, -0.476], "rotation": [-0.57, -4.752, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0158], [0.0165, -0.0148], [0.0326, -0.012], [0.0482, -0.0073], [0.063, -0.0008], [0.0767, 0.0075], [0.0891, 0.0173], [0.1, 0.0288], [0.1094, 0.0416], [0.117, 0.0557], [0.1228, 0.0709], [0.1269, 0.0871], [0.1292, 0.104], [0.1297, 0.1216], [0.1287, 0.1395], [0.1261, 0.1576], [0.1217, 0.1757], [0.1038, 0.1936], [0.0577, 0.2112], [0.0413, 0.2281], [0.0718, 0.2443], [0.085, 0.2595], [0.078, 0.2736], [0.0687, 0.2864], [0.0591, 0.2979], [0.0494, 0.3077], [0.0396, 0.316], [0.0297, 0.3225], [0.0198, 0.3272], [0.0099, 0.33], [0.0, 0.331], [-0.0099, 0.33], [-0.0193, 0.3272], [-0.0251, 0.3225], [-0.029, 0.316], [-0.0423, 0.3077], [-0.0581, 0.2979], [-0.0687, 0.2864], [-0.078, 0.2736], [-0.087, 0.2595], [-0.0955, 0.2443], [-0.1035, 0.2281], [-0.1106, 0.2112], [-0.1169, 0.1936], [-0.1221, 0.1757], [-0.1261, 0.1576], [-0.1283, 0.1395], [-0.1152, 0.1216], [-0.0674, 0.104], [-0.0506, 0.0871], [-0.0923, 0.0709], [-0.117, 0.0557], [-0.1094, 0.0416], [-0.1, 0.0288], [-0.0891, 0.0173], [-0.0767, 0.0075], [-0.063, -0.0008], [-0.0482, -0.0073], [-0.0326, -0.012], [-0.0165, -0.0148], [-0.0, -0.0158]], "depth": 0.004, "ovalHoles": [{"cx": 0.039400000000000004, "cy": 0.12608, "rx": 0.009456, "ry": 0.02364}, {"cx": -0.03546, "cy": 0.17336000000000001, "rx": 0.00788, "ry": 0.020488}]}}};
  node_lamina_6_17.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-6"] ?? root).add(node_lamina_6_17);
  nodes["lamina-6"] = node_lamina_6_17;
  const mesh_lamina_6_17Geometry = endpoint_lamina_6_17
    ? new THREE.CylinderGeometry(endpoint_lamina_6_17.endRadius, endpoint_lamina_6_17.baseRadius, endpoint_lamina_6_17.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0158], [0.0165, -0.0148], [0.0326, -0.012], [0.0482, -0.0073], [0.063, -0.0008], [0.0767, 0.0075], [0.0891, 0.0173], [0.1, 0.0288], [0.1094, 0.0416], [0.117, 0.0557], [0.1228, 0.0709], [0.1269, 0.0871], [0.1292, 0.104], [0.1297, 0.1216], [0.1287, 0.1395], [0.1261, 0.1576], [0.1217, 0.1757], [0.1038, 0.1936], [0.0577, 0.2112], [0.0413, 0.2281], [0.0718, 0.2443], [0.085, 0.2595], [0.078, 0.2736], [0.0687, 0.2864], [0.0591, 0.2979], [0.0494, 0.3077], [0.0396, 0.316], [0.0297, 0.3225], [0.0198, 0.3272], [0.0099, 0.33], [0.0, 0.331], [-0.0099, 0.33], [-0.0193, 0.3272], [-0.0251, 0.3225], [-0.029, 0.316], [-0.0423, 0.3077], [-0.0581, 0.2979], [-0.0687, 0.2864], [-0.078, 0.2736], [-0.087, 0.2595], [-0.0955, 0.2443], [-0.1035, 0.2281], [-0.1106, 0.2112], [-0.1169, 0.1936], [-0.1221, 0.1757], [-0.1261, 0.1576], [-0.1283, 0.1395], [-0.1152, 0.1216], [-0.0674, 0.104], [-0.0506, 0.0871], [-0.0923, 0.0709], [-0.117, 0.0557], [-0.1094, 0.0416], [-0.1, 0.0288], [-0.0891, 0.0173], [-0.0767, 0.0075], [-0.063, -0.0008], [-0.0482, -0.0073], [-0.0326, -0.012], [-0.0165, -0.0148], [-0.0, -0.0158]], "depth": 0.004, "ovalHoles": [{"cx": 0.039400000000000004, "cy": 0.12608, "rx": 0.009456, "ry": 0.02364}, {"cx": -0.03546, "cy": 0.17336000000000001, "rx": 0.00788, "ry": 0.020488}]});
  const mesh_lamina_6_17 = new THREE.Mesh(
    mesh_lamina_6_17Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_6_17.name = "leaf-lamina-6";
  if (endpoint_lamina_6_17) {
    mesh_lamina_6_17.position.copy(endpoint_lamina_6_17.midpoint);
    mesh_lamina_6_17.quaternion.copy(endpoint_lamina_6_17.quaternion);
  }
  mesh_lamina_6_17.castShadow = options.castShadow ?? true;
  mesh_lamina_6_17.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_6_17.userData.sculptComponent = {"id": "lamina-6", "name": "leaf-lamina-6", "level": "macro", "primitive": "extrude", "parent": "petiole-6", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [0.019, 0.208, -0.476], "rotation": [-0.57, -4.752, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0158], [0.0165, -0.0148], [0.0326, -0.012], [0.0482, -0.0073], [0.063, -0.0008], [0.0767, 0.0075], [0.0891, 0.0173], [0.1, 0.0288], [0.1094, 0.0416], [0.117, 0.0557], [0.1228, 0.0709], [0.1269, 0.0871], [0.1292, 0.104], [0.1297, 0.1216], [0.1287, 0.1395], [0.1261, 0.1576], [0.1217, 0.1757], [0.1038, 0.1936], [0.0577, 0.2112], [0.0413, 0.2281], [0.0718, 0.2443], [0.085, 0.2595], [0.078, 0.2736], [0.0687, 0.2864], [0.0591, 0.2979], [0.0494, 0.3077], [0.0396, 0.316], [0.0297, 0.3225], [0.0198, 0.3272], [0.0099, 0.33], [0.0, 0.331], [-0.0099, 0.33], [-0.0193, 0.3272], [-0.0251, 0.3225], [-0.029, 0.316], [-0.0423, 0.3077], [-0.0581, 0.2979], [-0.0687, 0.2864], [-0.078, 0.2736], [-0.087, 0.2595], [-0.0955, 0.2443], [-0.1035, 0.2281], [-0.1106, 0.2112], [-0.1169, 0.1936], [-0.1221, 0.1757], [-0.1261, 0.1576], [-0.1283, 0.1395], [-0.1152, 0.1216], [-0.0674, 0.104], [-0.0506, 0.0871], [-0.0923, 0.0709], [-0.117, 0.0557], [-0.1094, 0.0416], [-0.1, 0.0288], [-0.0891, 0.0173], [-0.0767, 0.0075], [-0.063, -0.0008], [-0.0482, -0.0073], [-0.0326, -0.012], [-0.0165, -0.0148], [-0.0, -0.0158]], "depth": 0.004, "ovalHoles": [{"cx": 0.039400000000000004, "cy": 0.12608, "rx": 0.009456, "ry": 0.02364}, {"cx": -0.03546, "cy": 0.17336000000000001, "rx": 0.00788, "ry": 0.020488}]}}};
  node_lamina_6_17.add(mesh_lamina_6_17);
  meshes["lamina-6"] = mesh_lamina_6_17;
  colliders["lamina-6"] = {};

  const attachment_petiole_7_18 = {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.156, 0.64, 0.046], "localEnd": [0.054, 0.837, -0.198], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002};
  const endpoint_petiole_7_18 = makeAttachmentEndpoint(attachment_petiole_7_18);
  const node_petiole_7_18 = new THREE.Group();
  node_petiole_7_18.name = "petiole-7__pivot";
  if (endpoint_petiole_7_18) {
    node_petiole_7_18.position.copy(endpoint_petiole_7_18.start);
    node_petiole_7_18.rotation.set(0, 0, 0);
    node_petiole_7_18.scale.set(1, 1, 1);
  } else {
    node_petiole_7_18.position.set(0, 0, 0);
    node_petiole_7_18.rotation.set(0, 0, 0);
    node_petiole_7_18.scale.set(1, 1, 1);
  }
  node_petiole_7_18.userData.sculptComponent = {"id": "petiole-7", "name": "petiole-7", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.156, 0.64, 0.046], "localEnd": [0.054, 0.837, -0.198], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_7_18.userData.actionProfile = {"animatable": true, "pivot": {"ref": "attachment.localStart"}};
  (nodes["stem"] ?? root).add(node_petiole_7_18);
  nodes["petiole-7"] = node_petiole_7_18;
  const mesh_petiole_7_18Geometry = endpoint_petiole_7_18
    ? new THREE.CylinderGeometry(endpoint_petiole_7_18.endRadius, endpoint_petiole_7_18.baseRadius, endpoint_petiole_7_18.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_petiole_7_18 = new THREE.Mesh(
    mesh_petiole_7_18Geometry,
    materialMap["stem-green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_petiole_7_18.name = "petiole-7";
  if (endpoint_petiole_7_18) {
    mesh_petiole_7_18.position.copy(endpoint_petiole_7_18.midpoint);
    mesh_petiole_7_18.quaternion.copy(endpoint_petiole_7_18.quaternion);
  }
  mesh_petiole_7_18.castShadow = options.castShadow ?? true;
  mesh_petiole_7_18.receiveShadow = options.receiveShadow ?? true;
  mesh_petiole_7_18.userData.sculptComponent = {"id": "petiole-7", "name": "petiole-7", "level": "macro", "primitive": "tube", "parent": "stem", "topologyClass": "fiber-strand", "topologyRationale": "잎자루 스트랜드 — 바깥·위로 뻗는 테이퍼 관", "material": "stem-green", "colorMaterialRecipe": {"dominantAlbedo": "rgba(90, 122, 66, 1)", "secondaryAlbedo": "rgba(104, 138, 78, 1)", "materialClass": "unknown", "materialClassConfidence": 0.8}, "actionProfile": {"animatable": true, "pivot": {"ref": "attachment.localStart"}}, "attachment": {"parentId": "stem", "parentSocket": "stem-node", "contactType": "socket", "localStart": [-0.156, 0.64, 0.046], "localEnd": [0.054, 0.837, -0.198], "baseRadius": 0.01, "endRadius": 0.006, "embedDepth": 0.008, "gapTolerance": 0.002}};
  node_petiole_7_18.add(mesh_petiole_7_18);
  meshes["petiole-7"] = mesh_petiole_7_18;
  colliders["petiole-7"] = {};

  const attachment_lamina_7_19 = null;
  const endpoint_lamina_7_19 = makeAttachmentEndpoint(attachment_lamina_7_19);
  const node_lamina_7_19 = new THREE.Group();
  node_lamina_7_19.name = "leaf-lamina-7__pivot";
  if (endpoint_lamina_7_19) {
    node_lamina_7_19.position.copy(endpoint_lamina_7_19.start);
    node_lamina_7_19.rotation.set(0, 0, 0);
    node_lamina_7_19.scale.set(1, 1, 1);
  } else {
    node_lamina_7_19.position.set(0.21, 0.196, -0.244);
    node_lamina_7_19.rotation.set(-0.815, -5.424, 0.0);
    node_lamina_7_19.scale.set(1, 1, 1);
  }
  node_lamina_7_19.userData.sculptComponent = {"id": "lamina-7", "name": "leaf-lamina-7", "level": "macro", "primitive": "extrude", "parent": "petiole-7", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [0.21, 0.196, -0.244], "rotation": [-0.815, -5.424, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0127], [0.0132, -0.0119], [0.0262, -0.0096], [0.0388, -0.0059], [0.0507, -0.0006], [0.0617, 0.006], [0.0717, 0.014], [0.0805, 0.0231], [0.088, 0.0335], [0.0941, 0.0448], [0.0988, 0.0571], [0.1021, 0.0701], [0.1039, 0.0837], [0.1044, 0.0978], [0.1035, 0.1122], [0.1014, 0.1268], [0.0982, 0.1414], [0.0941, 0.1558], [0.089, 0.1699], [0.0832, 0.1835], [0.0769, 0.1965], [0.07, 0.2088], [0.0615, 0.2201], [0.0482, 0.2305], [0.0335, 0.2396], [0.0262, 0.2476], [0.0253, 0.2542], [0.0225, 0.2595], [0.0158, 0.2632], [0.008, 0.2655], [0.0, 0.2663], [-0.008, 0.2655], [-0.0159, 0.2632], [-0.0239, 0.2595], [-0.0318, 0.2542], [-0.0397, 0.2476], [-0.0476, 0.2396], [-0.0553, 0.2305], [-0.0628, 0.2201], [-0.07, 0.2088], [-0.0769, 0.1965], [-0.0832, 0.1835], [-0.0866, 0.1699], [-0.0765, 0.1558], [-0.0491, 0.1414], [-0.0325, 0.1268], [-0.0517, 0.1122], [-0.0849, 0.0978], [-0.1012, 0.0837], [-0.102, 0.0701], [-0.0988, 0.0571], [-0.0941, 0.0448], [-0.088, 0.0335], [-0.0805, 0.0231], [-0.0717, 0.014], [-0.0617, 0.006], [-0.0507, -0.0006], [-0.0388, -0.0059], [-0.0262, -0.0096], [-0.0132, -0.0119], [-0.0, -0.0127]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_7_19.userData.actionProfile = {"animatable": true, "pivot": {"ref": "origin"}};
  (nodes["petiole-7"] ?? root).add(node_lamina_7_19);
  nodes["lamina-7"] = node_lamina_7_19;
  const mesh_lamina_7_19Geometry = endpoint_lamina_7_19
    ? new THREE.CylinderGeometry(endpoint_lamina_7_19.endRadius, endpoint_lamina_7_19.baseRadius, endpoint_lamina_7_19.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.0, -0.0127], [0.0132, -0.0119], [0.0262, -0.0096], [0.0388, -0.0059], [0.0507, -0.0006], [0.0617, 0.006], [0.0717, 0.014], [0.0805, 0.0231], [0.088, 0.0335], [0.0941, 0.0448], [0.0988, 0.0571], [0.1021, 0.0701], [0.1039, 0.0837], [0.1044, 0.0978], [0.1035, 0.1122], [0.1014, 0.1268], [0.0982, 0.1414], [0.0941, 0.1558], [0.089, 0.1699], [0.0832, 0.1835], [0.0769, 0.1965], [0.07, 0.2088], [0.0615, 0.2201], [0.0482, 0.2305], [0.0335, 0.2396], [0.0262, 0.2476], [0.0253, 0.2542], [0.0225, 0.2595], [0.0158, 0.2632], [0.008, 0.2655], [0.0, 0.2663], [-0.008, 0.2655], [-0.0159, 0.2632], [-0.0239, 0.2595], [-0.0318, 0.2542], [-0.0397, 0.2476], [-0.0476, 0.2396], [-0.0553, 0.2305], [-0.0628, 0.2201], [-0.07, 0.2088], [-0.0769, 0.1965], [-0.0832, 0.1835], [-0.0866, 0.1699], [-0.0765, 0.1558], [-0.0491, 0.1414], [-0.0325, 0.1268], [-0.0517, 0.1122], [-0.0849, 0.0978], [-0.1012, 0.0837], [-0.102, 0.0701], [-0.0988, 0.0571], [-0.0941, 0.0448], [-0.088, 0.0335], [-0.0805, 0.0231], [-0.0717, 0.014], [-0.0617, 0.006], [-0.0507, -0.0006], [-0.0388, -0.0059], [-0.0262, -0.0096], [-0.0132, -0.0119], [-0.0, -0.0127]], "depth": 0.004, "ovalHoles": []});
  const mesh_lamina_7_19 = new THREE.Mesh(
    mesh_lamina_7_19Geometry,
    materialMap["leaf-satin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamina_7_19.name = "leaf-lamina-7";
  if (endpoint_lamina_7_19) {
    mesh_lamina_7_19.position.copy(endpoint_lamina_7_19.midpoint);
    mesh_lamina_7_19.quaternion.copy(endpoint_lamina_7_19.quaternion);
  }
  mesh_lamina_7_19.castShadow = options.castShadow ?? true;
  mesh_lamina_7_19.receiveShadow = options.receiveShadow ?? true;
  mesh_lamina_7_19.userData.sculptComponent = {"id": "lamina-7", "name": "leaf-lamina-7", "level": "macro", "primitive": "extrude", "parent": "petiole-7", "topologyClass": "conforming-shell", "topologyRationale": "잎몸 셸 — 절개가 외곽에 인코딩된 심장형 프로파일 미세 압출", "material": "leaf-satin", "colorMaterialRecipe": {"dominantAlbedo": "rgba(47, 102, 51, 1)", "secondaryAlbedo": "rgba(74, 128, 66, 1)", "materialClass": "unknown", "materialClassConfidence": 0.85}, "actionProfile": {"animatable": true, "pivot": {"ref": "origin"}}, "localFeatures": [{"id": "fenestration-slits", "type": "topology-hole", "description": "외곽 인코딩 절개"}, {"id": "interior-holes", "type": "topology-hole", "description": "타원 내부 구멍"}, {"id": "drip-tip", "type": "silhouette", "description": "끝 뾰족"}, {"id": "blade-droop", "type": "proportion", "description": "처짐 곡률"}], "transform": {"position": [0.21, 0.196, -0.244], "rotation": [-0.815, -5.424, 0]}, "geometryDescriptor": {"profile2D": {"points": [[0.0, -0.0127], [0.0132, -0.0119], [0.0262, -0.0096], [0.0388, -0.0059], [0.0507, -0.0006], [0.0617, 0.006], [0.0717, 0.014], [0.0805, 0.0231], [0.088, 0.0335], [0.0941, 0.0448], [0.0988, 0.0571], [0.1021, 0.0701], [0.1039, 0.0837], [0.1044, 0.0978], [0.1035, 0.1122], [0.1014, 0.1268], [0.0982, 0.1414], [0.0941, 0.1558], [0.089, 0.1699], [0.0832, 0.1835], [0.0769, 0.1965], [0.07, 0.2088], [0.0615, 0.2201], [0.0482, 0.2305], [0.0335, 0.2396], [0.0262, 0.2476], [0.0253, 0.2542], [0.0225, 0.2595], [0.0158, 0.2632], [0.008, 0.2655], [0.0, 0.2663], [-0.008, 0.2655], [-0.0159, 0.2632], [-0.0239, 0.2595], [-0.0318, 0.2542], [-0.0397, 0.2476], [-0.0476, 0.2396], [-0.0553, 0.2305], [-0.0628, 0.2201], [-0.07, 0.2088], [-0.0769, 0.1965], [-0.0832, 0.1835], [-0.0866, 0.1699], [-0.0765, 0.1558], [-0.0491, 0.1414], [-0.0325, 0.1268], [-0.0517, 0.1122], [-0.0849, 0.0978], [-0.1012, 0.0837], [-0.102, 0.0701], [-0.0988, 0.0571], [-0.0941, 0.0448], [-0.088, 0.0335], [-0.0805, 0.0231], [-0.0717, 0.014], [-0.0617, 0.006], [-0.0507, -0.0006], [-0.0388, -0.0059], [-0.0262, -0.0096], [-0.0132, -0.0119], [-0.0, -0.0127]], "depth": 0.004, "ovalHoles": []}}};
  node_lamina_7_19.add(mesh_lamina_7_19);
  meshes["lamina-7"] = mesh_lamina_7_19;
  colliders["lamina-7"] = {};

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createMonsteraPottedPlantLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Monstera Potted Plant look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"role": "key", "type": "directional", "color": "#fff3e4", "intensity": 1.3, "position": [2.5, 2.6, 3], "evidence": "우상단 웜 하이라이트·긴 그림자"}, {"role": "fill", "type": "ambient", "color": "#fff1e0", "intensity": 0.5, "evidence": "실내 산광 — 그림자 밝음"}, {"role": "rim", "type": "directional", "color": "#e9edf7", "intensity": 0.4, "position": [-2, 2.5, -2], "evidence": "잎 윤곽 쿨톤 분리광"}, {"role": "environment", "exposure": 1.0, "toneMapping": "ACESFilmic", "contactShadow": "contact shadow: soft ground shadow radius 0.35m opacity 0.4 (화분 밑 접지 그림자 관찰)", "evidence": "화분 밑 부드러운 접지 그림자 관찰"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createMonsteraPottedPlantEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameMonsteraPottedPlantCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createMonsteraPottedPlantPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureMonsteraPottedPlantRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createMonsteraPottedPlantInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
