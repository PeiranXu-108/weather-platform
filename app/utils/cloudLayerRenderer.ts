import { fetchWeatherPoint } from './weatherPointCache';

interface MapBounds {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
  zoom?: number;
}

export interface CloudCell {
  lat: number;
  lon: number;
  cloud: number; // 0-100
}

interface CloudCacheItem {
  cells: CloudCell[];
  timestamp: number;
}

export interface CloudLayerConfig {
  minGridCells: number;
  maxGridCells: number;
  cacheExpiry: number;
  samplingRatio: number;
  enableInterpolation: boolean;
  maxDrawCount: number;
  renderStyle: 'soft' | 'noise';
}

export interface CloudLayerRenderOptions {
  onProgress?: (progress: number) => void;
}

const DEFAULT_CONFIG: CloudLayerConfig = {
  minGridCells: 30,
  maxGridCells: 1600,
  cacheExpiry: 3 * 60 * 1000,
  samplingRatio: 0.25,
  enableInterpolation: true,
  maxDrawCount: 1400,
  renderStyle: 'noise',
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
  config: CloudLayerConfig
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

function interpolateValue(
  targetLat: number,
  targetLon: number,
  samplePoints: Array<{ lat: number; lon: number; value: number }>,
  power: number = 2,
  maxSearchDistance: number = 500
): number | null {
  if (samplePoints.length === 0) return null;

  for (const point of samplePoints) {
    if (Math.abs(point.lat - targetLat) < 0.0001 && Math.abs(point.lon - targetLon) < 0.0001) {
      return point.value;
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
    return nearest.value;
  }

  if (pointsWithDistance.length === 1) {
    return pointsWithDistance[0].value;
  }

  let weightedSum = 0;
  let weightSum = 0;
  const minDistance = 0.001;
  const nearestPoints = pointsWithDistance.slice(0, Math.min(10, pointsWithDistance.length));

  for (const point of nearestPoints) {
    if (point.distance < minDistance) {
      return point.value;
    }
    const weight = 1 / Math.pow(point.distance, power);
    weightedSum += weight * point.value;
    weightSum += weight;
  }

  if (weightSum === 0) return nearestPoints[0].value;
  return weightedSum / weightSum;
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
  limit: number,
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{ success: boolean; result: T | null; index: number }>> {
  if (tasks.length === 0) return [];
  const results: Array<{ success: boolean; result: T | null; index: number }> = [];
  const executing: Promise<void>[] = [];
  let currentIndex = 0;
  let completed = 0;

  const run = async (taskIndex: number): Promise<void> => {
    const task = tasks[taskIndex];
    try {
      const result = await task();
      results[taskIndex] = { success: true, result, index: taskIndex };
    } catch (error) {
      results[taskIndex] = { success: false, result: null, index: taskIndex };
    } finally {
      completed += 1;
      onProgress?.(completed, tasks.length);
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

async function fetchCloudValue(lat: number, lon: number): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const data = await fetchWeatherPoint(lat, lon, controller.signal);
    clearTimeout(timeout);
    const cloud = data?.current?.cloud ?? null;
    return cloud === null ? null : Math.max(0, Math.min(100, cloud));
  } catch (error) {
    return null;
  }
}

async function fetchGridClouds(
  allPoints: Array<{ lat: number; lon: number; row: number; col: number }>,
  rows: number,
  cols: number,
  config: CloudLayerConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<CloudCell[]> {
  const concurrencyLimit = 18;
  const baseSamplingRatio = config.enableInterpolation ? config.samplingRatio : 1.0;
  const samplingRatio = config.enableInterpolation
    ? calculateDynamicSamplingRatio(allPoints.length, baseSamplingRatio)
    : 1.0;

  const { samplePoints, sampleIndices } = selectSamplePoints(allPoints, samplingRatio, rows, cols);
  const tasks = samplePoints.map((point) => async () => {
    return await fetchCloudValue(point.lat, point.lon);
  });
  onProgress?.(0, samplePoints.length);
  const results = await pLimit(tasks, concurrencyLimit, onProgress);

  const sampleValues: Array<{ lat: number; lon: number; value: number }> = [];
  const sampleValueMap = new Map<number, number>();

  samplePoints.forEach((point, index) => {
    const result = results[index];
    if (result.success && result.result !== null) {
      const pointIndex = point.row * cols + point.col;
      sampleValues.push({
        lat: point.lat,
        lon: point.lon,
        value: result.result,
      });
      sampleValueMap.set(pointIndex, result.result);
    }
  });

  const cells: CloudCell[] = [];
  if (config.enableInterpolation && sampleValues.length > 0) {
    allPoints.forEach((point) => {
      const pointIndex = point.row * cols + point.col;
      let value: number | null = null;

      if (sampleIndices.has(pointIndex)) {
        value = sampleValueMap.get(pointIndex) ?? null;
      } else {
        value = interpolateValue(point.lat, point.lon, sampleValues);
      }

      if (value === null && sampleValues.length > 0) {
        const distances = sampleValues.map((sp) => ({
          ...sp,
          distance: calculateDistance(point.lat, point.lon, sp.lat, sp.lon),
        }));
        const nearest = distances.reduce((min, p) => (p.distance < min.distance ? p : min));
        value = nearest.value;
      }

      if (value !== null) {
        cells.push({
          lat: point.lat,
          lon: point.lon,
          cloud: value,
        });
      }
    });
  } else {
    sampleValues.forEach((sample) => {
      cells.push({
        lat: sample.lat,
        lon: sample.lon,
        cloud: sample.value,
      });
    });
  }

  return cells;
}

export class CloudLayerRenderer {
  private cache: Map<string, CloudCacheItem> = new Map();
  private config: CloudLayerConfig;
  private amap: any;
  private canvasLayer: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private requestInProgress: boolean = false;
  private lastBoundsHash: string | null = null;
  private cloudCells: CloudCell[] = [];
  private noiseCanvas: HTMLCanvasElement | null = null;
  private noisePattern: CanvasPattern | null = null;
  private noiseSeed: number = Math.random() * 1000;
  private lastNoiseSize: number = 0;
  private progress: number = 0;

  constructor(amap: any, config: Partial<CloudLayerConfig> = {}) {
    if (!amap) {
      console.warn('CloudLayerRenderer: Map instance is required');
    }
    this.amap = amap;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setMapInstance(amap: any): void {
    this.clear();
    this.amap = amap;
    this.lastBoundsHash = null;
  }

  setRenderStyle(style: 'soft' | 'noise'): void {
    this.config.renderStyle = style;
    this.renderClouds();
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
        this.canvasLayer.setBounds(
          new window.AMap.Bounds(
            new window.AMap.LngLat(bounds.southwest.lng, bounds.southwest.lat),
            new window.AMap.LngLat(bounds.northeast.lng, bounds.northeast.lat)
          )
        );
      }
      return;
    }

    const size = this.amap.getSize?.();
    this.canvas = document.createElement('canvas');
    this.canvas.width = size?.width || 1;
    this.canvas.height = size?.height || 1;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.warn('CloudLayerRenderer: Failed to get canvas context');
      return;
    }

    this.canvasLayer = new window.AMap.CanvasLayer({
      canvas: this.canvas,
      bounds: new window.AMap.Bounds(
        new window.AMap.LngLat(bounds.southwest.lng, bounds.southwest.lat),
        new window.AMap.LngLat(bounds.northeast.lng, bounds.northeast.lat)
      ),
      zIndex: 70,
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

  private ensureNoisePattern(size: number): void {
    if (!this.ctx || size <= 0) return;
    if (this.noiseCanvas && this.noisePattern && this.lastNoiseSize === size) {
      return;
    }

    this.lastNoiseSize = size;
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = size;
    this.noiseCanvas.height = size;
    const nctx = this.noiseCanvas.getContext('2d');
    if (!nctx) return;
    const imageData = nctx.createImageData(size, size);
    const data = imageData.data;
    let seed = this.noiseSeed;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 9301 + 49297) % 233280;
      const rand = seed / 233280;
      const value = 120 + rand * 120;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    nctx.putImageData(imageData, 0, 0);
    this.noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
  }

  private getCachedCells(boundsHash: string): CloudCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private setCachedCells(boundsHash: string, cells: CloudCell[]): void {
    this.cache.set(boundsHash, { cells, timestamp: Date.now() });
  }

  private drawCloudCell(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number): void {
    const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.55, `rgba(220, 220, 220, ${alpha * 0.7})`);
    gradient.addColorStop(1, `rgba(170, 170, 170, ${alpha * 0.2})`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.1, radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawNoiseCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    alpha: number
  ): void {
    if (!this.noisePattern) return;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.15, radius, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = this.noisePattern;
    ctx.translate(x - radius, y - radius);
    ctx.fillRect(0, 0, radius * 2, radius * 2);
    ctx.restore();
  }

  private renderClouds(): void {
    if (!this.ctx || !this.canvas || !this.isValidMapInstance()) return;
    this.updateCanvasSize();
    const ctx = this.ctx;
    const map = this.amap;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const drawEvery = Math.max(1, Math.ceil(this.cloudCells.length / this.config.maxDrawCount));
    if (this.config.renderStyle === 'noise') {
      this.ensureNoisePattern(128);
    }
    for (let i = 0; i < this.cloudCells.length; i += drawEvery) {
      const cell = this.cloudCells[i];
      const cloud = Math.max(0, Math.min(100, cell.cloud));
      if (cloud < 5) continue;
      const alpha = Math.min(0.55, 0.12 + (cloud / 100) * 0.6);
      const lngLat = new window.AMap.LngLat(cell.lon, cell.lat);
      const pixel = map.lngLatToContainer(lngLat);
      if (!pixel) continue;
      const radius = 12 + (cloud / 100) * 20;
      if (this.config.renderStyle === 'noise') {
        this.drawNoiseCloud(ctx, pixel.x, pixel.y, radius, alpha);
      }
      this.drawCloudCell(ctx, pixel.x, pixel.y, radius, alpha * 0.6);
    }
  }

  async renderCloudLayer(
    bounds: MapBounds,
    options: CloudLayerRenderOptions = {}
  ): Promise<void> {
    const reportProgress = (value: number) => {
      this.progress = value;
      options.onProgress?.(value);
    };

    if (!this.isValidMapInstance()) {
      reportProgress(100);
      return;
    }
    if (this.requestInProgress) {
      options.onProgress?.(this.progress);
      return;
    }

    const boundsHash = generateBoundsHash(bounds);
    this.ensureCanvasLayer(bounds);

    if (this.lastBoundsHash === boundsHash && this.cloudCells.length > 0) {
      this.renderClouds();
      reportProgress(100);
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.cloudCells = cached;
      this.lastBoundsHash = boundsHash;
      this.renderClouds();
      reportProgress(100);
      return;
    }

    this.requestInProgress = true;
    try {
      reportProgress(0);
      const { rows, cols } = calculateGridDimensions(bounds, this.config);
      const points = generateGridPoints(bounds, rows, cols);
      const cells = await fetchGridClouds(points, rows, cols, this.config, (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 85) : 85;
        reportProgress(Math.min(85, percent));
      });
      reportProgress(90);
      this.cloudCells = cells;
      this.setCachedCells(boundsHash, cells);
      this.lastBoundsHash = boundsHash;
      this.renderClouds();
      reportProgress(100);
    } catch (error) {
      console.error('Error rendering cloud layer:', error);
    } finally {
      this.requestInProgress = false;
      if (this.progress < 100) {
        reportProgress(100);
      }
    }
  }

  clear(): void {
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
        console.warn('Error removing cloud canvas layer:', error);
      }
    }
    this.canvasLayer = null;
    this.canvas = null;
    this.ctx = null;
    this.cloudCells = [];
    this.lastBoundsHash = null;
    this.noiseCanvas = null;
    this.noisePattern = null;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
