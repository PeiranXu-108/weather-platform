import { fetchWeatherPoint } from './weatherPointCache';
interface MapBounds {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
  zoom?: number;
}

export interface WindVectorCell {
  lat: number;
  lon: number;
  u: number; // east-west component (kph)
  v: number; // north-south component (kph)
  speed: number; // kph
}

interface WindCacheItem {
  cells: WindVectorCell[];
  timestamp: number;
}

export interface WindFieldConfig {
  minGridCells: number;
  maxGridCells: number;
  cacheExpiry: number;
  samplingRatio: number;
  enableInterpolation: boolean;
  maxDrawCount: number;
  animationSpeed: number;
  minLineLength: number;
  maxLineLength: number;
}

const DEFAULT_CONFIG: WindFieldConfig = {
  minGridCells: 30,
  maxGridCells: 1600,
  cacheExpiry: 3 * 60 * 1000,
  samplingRatio: 0.25,
  enableInterpolation: true,
  maxDrawCount: 1200,
  animationSpeed: 0.9,
  minLineLength: 6,
  maxLineLength: 28,
};

function generateBoundsHash(bounds: MapBounds): string {
  return `${bounds.northeast.lat.toFixed(4)}_${bounds.northeast.lng.toFixed(4)}_${bounds.southwest.lat.toFixed(4)}_${bounds.southwest.lng.toFixed(4)}`;
}

function calculateDynamicMaxCells(zoom?: number, baseMaxCells: number = 1600): number {
  if (!zoom) return baseMaxCells;
  const zoomFactor = Math.pow(Math.max(3, Math.min(20, zoom)) / 10, 1.4);
  const dynamicMaxCells = Math.floor(baseMaxCells * zoomFactor);
  return Math.max(100, Math.min(4000, dynamicMaxCells));
}

function calculateGridDimensions(
  bounds: MapBounds,
  config: WindFieldConfig
): { rows: number; cols: number } {
  const latDiff = Math.abs(bounds.northeast.lat - bounds.southwest.lat);
  const lngDiff = Math.abs(bounds.northeast.lng - bounds.southwest.lng);
  const aspectRatio = lngDiff / latDiff;
  const maxCells = calculateDynamicMaxCells(bounds.zoom, config.maxGridCells);
  const baseGridSize = Math.sqrt(maxCells / aspectRatio);

  let cols = Math.ceil(Math.sqrt(baseGridSize * baseGridSize * aspectRatio));
  let rows = Math.ceil(Math.sqrt(baseGridSize * baseGridSize / aspectRatio));

  const minRows = Math.ceil(Math.sqrt(config.minGridCells / aspectRatio));
  const minCols = Math.ceil(Math.sqrt(config.minGridCells * aspectRatio));
  if (rows < minRows) rows = minRows;
  if (cols < minCols) cols = minCols;

  const totalCells = rows * cols;
  if (totalCells > maxCells) {
    const scale = Math.sqrt(maxCells / totalCells);
    rows = Math.max(minRows, Math.floor(rows * scale));
    cols = Math.max(minCols, Math.floor(cols * scale));
  }

  const finalCells = rows * cols;
  if (finalCells < config.minGridCells) {
    const scale = Math.sqrt(config.minGridCells / finalCells);
    rows = Math.ceil(rows * scale);
    cols = Math.ceil(cols * scale);
  }

  return { rows, cols };
}

function generateGridPoints(
  bounds: MapBounds,
  rows: number,
  cols: number
): Array<{ lat: number; lon: number; row: number; col: number }> {
  const points: Array<{ lat: number; lon: number; row: number; col: number }> = [];
  const latDiff = bounds.northeast.lat - bounds.southwest.lat;
  const lngDiff = bounds.northeast.lng - bounds.southwest.lng;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const latRatio = (i + 0.5) / rows;
      const lngRatio = (j + 0.5) / cols;
      const lat = bounds.southwest.lat + latDiff * latRatio;
      const lon = bounds.southwest.lng + lngDiff * lngRatio;
      points.push({ lat, lon, row: i, col: j });
    }
  }

  return points;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function interpolateVector(
  targetLat: number,
  targetLon: number,
  samplePoints: Array<{ lat: number; lon: number; u: number; v: number }>,
  power: number = 2,
  maxSearchDistance: number = 500
): { u: number; v: number } | null {
  if (samplePoints.length === 0) return null;

  for (const point of samplePoints) {
    if (Math.abs(point.lat - targetLat) < 0.0001 && Math.abs(point.lon - targetLon) < 0.0001) {
      return { u: point.u, v: point.v };
    }
  }

  const pointsWithDistance = samplePoints
    .map((point) => {
      const distance = calculateDistance(targetLat, targetLon, point.lat, point.lon);
      return { ...point, distance };
    })
    .filter((p) => p.distance <= maxSearchDistance)
    .sort((a, b) => a.distance - b.distance);

  if (pointsWithDistance.length === 0) {
    const allDistances = samplePoints.map((point) => ({
      ...point,
      distance: calculateDistance(targetLat, targetLon, point.lat, point.lon),
    }));
    const nearest = allDistances.reduce((min, p) => (p.distance < min.distance ? p : min));
    return { u: nearest.u, v: nearest.v };
  }

  if (pointsWithDistance.length === 1) {
    return { u: pointsWithDistance[0].u, v: pointsWithDistance[0].v };
  }

  let weightedU = 0;
  let weightedV = 0;
  let weightSum = 0;
  const minDistance = 0.001;
  const nearestPoints = pointsWithDistance.slice(0, Math.min(10, pointsWithDistance.length));

  for (const point of nearestPoints) {
    if (point.distance < minDistance) {
      return { u: point.u, v: point.v };
    }
    const weight = 1 / Math.pow(point.distance, power);
    weightedU += weight * point.u;
    weightedV += weight * point.v;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return { u: nearestPoints[0].u, v: nearestPoints[0].v };
  }

  return { u: weightedU / weightSum, v: weightedV / weightSum };
}

function selectSamplePoints(
  allPoints: Array<{ lat: number; lon: number; row: number; col: number }>,
  samplingRatio: number,
  rows: number,
  cols: number
): {
  samplePoints: Array<{ lat: number; lon: number; row: number; col: number }>;
  sampleIndices: Set<number>;
} {
  if (samplingRatio >= 1) {
    const indices = new Set(allPoints.map((_, i) => i));
    return { samplePoints: allPoints, sampleIndices: indices };
  }

  const sampleInterval = Math.max(1, Math.floor(1 / samplingRatio));
  const samplePoints: Array<{ lat: number; lon: number; row: number; col: number }> = [];
  const sampleIndices = new Set<number>();

  for (let i = 0; i < rows; i += sampleInterval) {
    for (let j = 0; j < cols; j += sampleInterval) {
      const index = i * cols + j;
      if (index < allPoints.length) {
        samplePoints.push(allPoints[index]);
        sampleIndices.add(index);
      }
    }
  }

  const boundaryIndices = [0, cols - 1, (rows - 1) * cols, rows * cols - 1];
  boundaryIndices.forEach((idx) => {
    if (idx < allPoints.length && !sampleIndices.has(idx)) {
      samplePoints.push(allPoints[idx]);
      sampleIndices.add(idx);
    }
  });

  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const centerIndex = centerRow * cols + centerCol;
  if (centerIndex < allPoints.length && !sampleIndices.has(centerIndex)) {
    samplePoints.push(allPoints[centerIndex]);
    sampleIndices.add(centerIndex);
  }

  return { samplePoints, sampleIndices };
}

function calculateDynamicSamplingRatio(totalPoints: number, baseSamplingRatio: number): number {
  if (totalPoints < 200) return baseSamplingRatio;
  if (totalPoints > 1000) return Math.min(0.35, baseSamplingRatio * 1.2);
  return Math.min(0.3, baseSamplingRatio * 1.1);
}

async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<Array<{ success: boolean; result: T | null; index: number }>> {
  if (tasks.length === 0) return [];
  const results: Array<{ success: boolean; result: T | null; index: number }> = [];
  const executing: Promise<void>[] = [];
  let currentIndex = 0;

  const run = async (taskIndex: number): Promise<void> => {
    const task = tasks[taskIndex];
    try {
      const result = await task();
      results[taskIndex] = { success: true, result, index: taskIndex };
    } catch (error) {
      results[taskIndex] = { success: false, result: null, index: taskIndex };
    }
  };

  const enqueue = (): Promise<void> => {
    if (currentIndex >= tasks.length) return Promise.resolve();
    const taskIndex = currentIndex++;
    const promise = run(taskIndex).then(() => {
      const promiseIndex = executing.indexOf(promise);
      if (promiseIndex > -1) executing.splice(promiseIndex, 1);
      return enqueue();
    });
    executing.push(promise);
    return promise;
  };

  const initialCount = Math.min(limit, tasks.length);
  for (let i = 0; i < initialCount; i++) {
    enqueue();
  }
  await Promise.all(executing);
  return results.sort((a, b) => a.index - b.index);
}

function windToVector(speedKph: number, degree: number): { u: number; v: number } {
  const toDeg = (degree + 180) % 360;
  const rad = (toDeg * Math.PI) / 180;
  return {
    u: Math.sin(rad) * speedKph,
    v: Math.cos(rad) * speedKph,
  };
}

async function fetchWindVector(lat: number, lon: number): Promise<{ u: number; v: number; speed: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const data = await fetchWeatherPoint(lat, lon, controller.signal);
    clearTimeout(timeout);
    const speed = data?.current?.wind_kph ?? null;
    const degree = data?.current?.wind_degree ?? null;
    if (speed === null || degree === null) return null;
    const vector = windToVector(speed, degree);
    return { ...vector, speed };
  } catch (error) {
    return null;
  }
}

async function fetchGridWind(
  allPoints: Array<{ lat: number; lon: number; row: number; col: number }>,
  rows: number,
  cols: number,
  config: WindFieldConfig
): Promise<WindVectorCell[]> {
  const concurrencyLimit = 18;
  const baseSamplingRatio = config.enableInterpolation ? config.samplingRatio : 1.0;
  const samplingRatio = config.enableInterpolation
    ? calculateDynamicSamplingRatio(allPoints.length, baseSamplingRatio)
    : 1.0;

  const { samplePoints, sampleIndices } = selectSamplePoints(allPoints, samplingRatio, rows, cols);
  const tasks = samplePoints.map((point) => async () => {
    return await fetchWindVector(point.lat, point.lon);
  });
  const results = await pLimit(tasks, concurrencyLimit);

  const sampleVectors: Array<{ lat: number; lon: number; u: number; v: number; speed: number }> = [];
  const sampleVectorMap = new Map<number, { u: number; v: number; speed: number }>();

  samplePoints.forEach((point, index) => {
    const result = results[index];
    if (result.success && result.result !== null) {
      const pointIndex = point.row * cols + point.col;
      sampleVectors.push({
        lat: point.lat,
        lon: point.lon,
        ...result.result,
      });
      sampleVectorMap.set(pointIndex, result.result);
    }
  });

  const cells: WindVectorCell[] = [];
  if (config.enableInterpolation && sampleVectors.length > 0) {
    allPoints.forEach((point) => {
      const pointIndex = point.row * cols + point.col;
      let vector: { u: number; v: number; speed: number } | null = null;

      if (sampleIndices.has(pointIndex)) {
        vector = sampleVectorMap.get(pointIndex) || null;
      } else {
        const interpolated = interpolateVector(point.lat, point.lon, sampleVectors);
        if (interpolated) {
          const speed = Math.sqrt(interpolated.u * interpolated.u + interpolated.v * interpolated.v);
          vector = { ...interpolated, speed };
        }
      }

      if (vector === null && sampleVectors.length > 0) {
        const distances = sampleVectors.map((sp) => ({
          ...sp,
          distance: calculateDistance(point.lat, point.lon, sp.lat, sp.lon),
        }));
        const nearest = distances.reduce((min, p) => (p.distance < min.distance ? p : min));
        vector = { u: nearest.u, v: nearest.v, speed: nearest.speed };
      }

      if (vector !== null) {
        cells.push({
          lat: point.lat,
          lon: point.lon,
          u: vector.u,
          v: vector.v,
          speed: vector.speed,
        });
      }
    });
  } else {
    sampleVectors.forEach((sample) => {
      cells.push({
        lat: sample.lat,
        lon: sample.lon,
        u: sample.u,
        v: sample.v,
        speed: sample.speed,
      });
    });
  }

  return cells;
}

export class WindFieldRenderer {
  private cache: Map<string, WindCacheItem> = new Map();
  private config: WindFieldConfig;
  private amap: any;
  private canvasLayer: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrame: number | null = null;
  private lastFrameTime: number = 0;
  private lastPixelUpdate: number = 0;
  private cachedDrawItems: Array<{
    x: number;
    y: number;
    u: number;
    v: number;
    speed: number;
  }> = [];
  private cachedDrawEvery: number = 1;
  private requestInProgress: boolean = false;
  private lastBoundsHash: string | null = null;
  private windCells: WindVectorCell[] = [];
  private currentBounds: MapBounds | null = null;

  constructor(amap: any, config: Partial<WindFieldConfig> = {}) {
    if (!amap) {
      console.warn('WindFieldRenderer: Map instance is required');
    }
    this.amap = amap;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setMapInstance(amap: any): void {
    this.clear();
    this.amap = amap;
    this.lastBoundsHash = null;
  }

  private isValidMapInstance(): boolean {
    if (!this.amap) return false;
    if (typeof this.amap.add !== 'function' && typeof this.amap.remove !== 'function') {
      return false;
    }
    try {
      const container = this.amap.getContainer?.();
      if (!container) return false;
    } catch (error) {
      return false;
    }
    return true;
  }

  private ensureCanvasLayer(bounds: MapBounds): void {
    if (this.canvasLayer && this.canvas && this.ctx) {
      this.updateCanvasSize();
      if (this.canvasLayer.setBounds) {
        this.canvasLayer.setBounds(new window.AMap.Bounds(
          new window.AMap.LngLat(bounds.southwest.lng, bounds.southwest.lat),
          new window.AMap.LngLat(bounds.northeast.lng, bounds.northeast.lat)
        ));
      }
      return;
    }

    const size = this.amap.getSize?.();
    this.canvas = document.createElement('canvas');
    this.canvas.width = size?.width || 1;
    this.canvas.height = size?.height || 1;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      console.warn('WindFieldRenderer: Failed to get canvas context');
      return;
    }

    this.canvasLayer = new window.AMap.CanvasLayer({
      canvas: this.canvas,
      bounds: new window.AMap.Bounds(
        new window.AMap.LngLat(bounds.southwest.lng, bounds.southwest.lat),
        new window.AMap.LngLat(bounds.northeast.lng, bounds.northeast.lat)
      ),
      zIndex: 120,
      opacity: 1,
      zooms: [3, 20],
    });

    if (this.amap.add && typeof this.amap.add === 'function') {
      this.amap.add(this.canvasLayer);
    } else if (this.canvasLayer.setMap) {
      this.canvasLayer.setMap(this.amap);
    }
  }

  private updateCanvasSize(): void {
    if (!this.canvas || !this.amap) return;
    const size = this.amap.getSize?.();
    if (!size) return;
    if (this.canvas.width !== size.width || this.canvas.height !== size.height) {
      this.canvas.width = size.width;
      this.canvas.height = size.height;
    }
  }

  private getCachedCells(boundsHash: string): WindVectorCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private setCachedCells(boundsHash: string, cells: WindVectorCell[]): void {
    this.cache.set(boundsHash, { cells, timestamp: Date.now() });
  }

  private stopAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.lastFrameTime = 0;
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    headLength: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  private updateDrawCache(drawEvery: number, map: any, now: number): void {
    if (!this.windCells.length) {
      this.cachedDrawItems = [];
      return;
    }
    if (drawEvery === this.cachedDrawEvery && now - this.lastPixelUpdate < 120) {
      return;
    }
    this.cachedDrawEvery = drawEvery;
    this.lastPixelUpdate = now;
    this.cachedDrawItems = [];

    for (let i = 0; i < this.windCells.length; i += drawEvery) {
      const cell = this.windCells[i];
      const lngLat = new window.AMap.LngLat(cell.lon, cell.lat);
      const pixel = map.lngLatToContainer(lngLat);
      if (!pixel) continue;
      this.cachedDrawItems.push({
        x: pixel.x,
        y: pixel.y,
        u: cell.u,
        v: cell.v,
        speed: cell.speed,
      });
    }
  }

  private startAnimation(): void {
    if (!this.ctx || !this.canvas || !this.currentBounds || !this.isValidMapInstance()) return;
    const ctx = this.ctx;
    const map = this.amap;

    const animate = () => {
      if (!this.ctx || !this.canvas) return;
      const now = performance.now();
      if (this.lastFrameTime && now - this.lastFrameTime < 33) {
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }
      this.lastFrameTime = now;

      this.updateCanvasSize();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const time = now * this.config.animationSpeed;
      const drawEvery = Math.max(1, Math.ceil(this.windCells.length / this.config.maxDrawCount));
      this.updateDrawCache(drawEvery, map, now);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 2;

      for (let i = 0; i < this.cachedDrawItems.length; i++) {
        const item = this.cachedDrawItems[i];
        const speed = Math.max(0.1, item.speed);
        const length = Math.min(
          this.config.maxLineLength,
          this.config.minLineLength + speed * 1.1
        );
        const magnitude = Math.sqrt(item.u * item.u + item.v * item.v);
        if (magnitude === 0) continue;
        const dirX = item.u / magnitude;
        const dirY = -item.v / magnitude;

        const spacing = 26;
        const seed = (i % 97) * 0.37;
        const travel = (time * (speed / 120) + seed) % spacing;

        for (let k = 0; k < 2; k++) {
          const offset = travel + k * spacing;
          const startX = item.x + dirX * (offset - spacing);
          const startY = item.y + dirY * (offset - spacing);
          const endX = startX + dirX * length;
          const endY = startY + dirY * length;
          this.drawArrow(ctx, startX, startY, endX, endY, Math.max(2.5, length * 0.18));
        }
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.stopAnimation();
    this.animationFrame = requestAnimationFrame(animate);
  }

  async renderWindField(bounds: MapBounds): Promise<void> {
    if (!this.isValidMapInstance()) return;
    if (this.requestInProgress) return;

    const boundsHash = generateBoundsHash(bounds);
    this.currentBounds = bounds;
    this.ensureCanvasLayer(bounds);

    if (this.lastBoundsHash === boundsHash && this.windCells.length > 0) {
      this.startAnimation();
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.windCells = cached;
      this.lastBoundsHash = boundsHash;
      this.startAnimation();
      return;
    }

    this.requestInProgress = true;
    try {
      const { rows, cols } = calculateGridDimensions(bounds, this.config);
      const points = generateGridPoints(bounds, rows, cols);
      const cells = await fetchGridWind(points, rows, cols, this.config);
      this.windCells = cells;
      this.setCachedCells(boundsHash, cells);
      this.lastBoundsHash = boundsHash;
      this.startAnimation();
    } catch (error) {
      console.error('Error rendering wind field:', error);
    } finally {
      this.requestInProgress = false;
    }
  }

  clear(): void {
    this.stopAnimation();
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.canvasLayer) {
      try {
        if (this.amap && this.amap.remove) {
          this.amap.remove(this.canvasLayer);
        }
        if (this.canvasLayer.setMap) {
          this.canvasLayer.setMap(null);
        }
      } catch (error) {
        console.warn('Error removing wind canvas layer:', error);
      }
    }
    this.canvasLayer = null;
    this.canvas = null;
    this.ctx = null;
    this.windCells = [];
    this.currentBounds = null;
    this.lastBoundsHash = null;
    this.cachedDrawItems = [];
  }

  clearCache(): void {
    this.cache.clear();
  }
}
