import { fetchWeatherPoint } from './weatherPointCache';

interface MapBounds {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
  zoom?: number;
}

export interface PrecipCell {
  lat: number;
  lon: number;
  precip: number; // mm
}

interface PrecipCacheItem {
  cells: PrecipCell[];
  timestamp: number;
}

export interface PrecipLayerConfig {
  minGridCells: number;
  maxGridCells: number;
  cacheExpiry: number;
  samplingRatio: number;
  enableInterpolation: boolean;
  maxDrawCount: number;
}

const DEFAULT_CONFIG: PrecipLayerConfig = {
  minGridCells: 30,
  maxGridCells: 1600,
  cacheExpiry: 3 * 60 * 1000,
  samplingRatio: 0.25,
  enableInterpolation: true,
  maxDrawCount: 1800,
};

const DEFAULT_BINS = [0, 0.1, 1, 5, 10, 25, 50];
const DEFAULT_COLORS = [
  'rgba(0, 0, 0, 0)',
  'rgba(120, 190, 255, 0.55)',
  'rgba(60, 150, 255, 0.7)',
  'rgba(30, 110, 240, 0.78)',
  'rgba(70, 80, 230, 0.82)',
  'rgba(110, 60, 210, 0.86)',
  'rgba(150, 50, 200, 0.9)',
];

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
  config: PrecipLayerConfig
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

async function fetchPrecipValue(lat: number, lon: number): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const data = await fetchWeatherPoint(lat, lon, controller.signal);
    clearTimeout(timeout);
    const precip = data?.current?.precip_mm ?? null;
    if (precip === null) return null;
    return Math.max(0, precip);
  } catch (error) {
    return null;
  }
}

function getPrecipColor(value: number): string {
  for (let i = DEFAULT_BINS.length - 1; i >= 0; i--) {
    if (value >= DEFAULT_BINS[i]) {
      return DEFAULT_COLORS[i];
    }
  }
  return DEFAULT_COLORS[0];
}

async function fetchGridPrecip(
  allPoints: Array<{ lat: number; lon: number; row: number; col: number }>,
  rows: number,
  cols: number,
  config: PrecipLayerConfig
): Promise<PrecipCell[]> {
  const concurrencyLimit = 18;
  const baseSamplingRatio = config.enableInterpolation ? config.samplingRatio : 1.0;
  const samplingRatio = config.enableInterpolation
    ? calculateDynamicSamplingRatio(allPoints.length, baseSamplingRatio)
    : 1.0;

  const { samplePoints, sampleIndices } = selectSamplePoints(allPoints, samplingRatio, rows, cols);
  const tasks = samplePoints.map((point) => async () => {
    return await fetchPrecipValue(point.lat, point.lon);
  });
  const results = await pLimit(tasks, concurrencyLimit);

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

  const cells: PrecipCell[] = [];
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
          precip: value,
        });
      }
    });
  } else {
    sampleValues.forEach((sample) => {
      cells.push({
        lat: sample.lat,
        lon: sample.lon,
        precip: sample.value,
      });
    });
  }

  return cells;
}

export class PrecipLayerRenderer {
  private cache: Map<string, PrecipCacheItem> = new Map();
  private config: PrecipLayerConfig;
  private amap: any;
  private canvasLayer: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private requestInProgress: boolean = false;
  private lastBoundsHash: string | null = null;
  private precipCells: PrecipCell[] = [];
  private lastBounds: MapBounds | null = null;
  private lastRows: number = 0;
  private lastCols: number = 0;

  constructor(amap: any, config: Partial<PrecipLayerConfig> = {}) {
    if (!amap) {
      console.warn('PrecipLayerRenderer: Map instance is required');
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
      console.warn('PrecipLayerRenderer: Failed to get canvas context');
      return;
    }

    this.canvasLayer = new window.AMap.CanvasLayer({
      canvas: this.canvas,
      bounds: new window.AMap.Bounds(
        new window.AMap.LngLat(bounds.southwest.lng, bounds.southwest.lat),
        new window.AMap.LngLat(bounds.northeast.lng, bounds.northeast.lat)
      ),
      zIndex: 130,
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

  private getCachedCells(boundsHash: string): PrecipCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private setCachedCells(boundsHash: string, cells: PrecipCell[]): void {
    this.cache.set(boundsHash, { cells, timestamp: Date.now() });
  }

  private renderPrecip(): void {
    if (!this.ctx || !this.canvas || !this.isValidMapInstance()) return;
    this.updateCanvasSize();
    const ctx = this.ctx;
    const map = this.amap;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.lastBounds || this.lastRows <= 0 || this.lastCols <= 0) {
      return;
    }

    const drawEvery = Math.max(1, Math.ceil(this.precipCells.length / this.config.maxDrawCount));
    for (let i = 0; i < this.precipCells.length; i += drawEvery) {
      const cell = this.precipCells[i];
      const value = Math.max(0, cell.precip);
      if (value <= 0) continue;

      const latDiff = this.lastBounds.northeast.lat - this.lastBounds.southwest.lat;
      const lngDiff = this.lastBounds.northeast.lng - this.lastBounds.southwest.lng;
      const cellLatHeight = latDiff / this.lastRows;
      const cellLngWidth = lngDiff / this.lastCols;

      let row = Math.floor((cell.lat - this.lastBounds.southwest.lat) / cellLatHeight);
      let col = Math.floor((cell.lon - this.lastBounds.southwest.lng) / cellLngWidth);
      row = Math.max(0, Math.min(this.lastRows - 1, row));
      col = Math.max(0, Math.min(this.lastCols - 1, col));

      const swLng = this.lastBounds.southwest.lng + col * cellLngWidth;
      const swLat = this.lastBounds.southwest.lat + row * cellLatHeight;
      const neLng = swLng + cellLngWidth;
      const neLat = swLat + cellLatHeight;

      const swPixel = map.lngLatToContainer(new window.AMap.LngLat(swLng, swLat));
      const nePixel = map.lngLatToContainer(new window.AMap.LngLat(neLng, neLat));
      if (!swPixel || !nePixel) continue;

      const left = Math.min(swPixel.x, nePixel.x) - 0.5;
      const right = Math.max(swPixel.x, nePixel.x) + 0.5;
      const top = Math.min(swPixel.y, nePixel.y) - 0.5;
      const bottom = Math.max(swPixel.y, nePixel.y) + 0.5;
      const width = right - left;
      const height = bottom - top;

      const color = getPrecipColor(value);
      ctx.fillStyle = color;
      ctx.fillRect(left, top, width, height);
    }
  }

  async renderPrecipLayer(bounds: MapBounds): Promise<void> {
    if (!this.isValidMapInstance()) return;
    if (this.requestInProgress) return;

    const boundsHash = generateBoundsHash(bounds);
    this.ensureCanvasLayer(bounds);
    const { rows, cols } = calculateGridDimensions(bounds, this.config);
    this.lastBounds = bounds;
    this.lastRows = rows;
    this.lastCols = cols;

    if (this.lastBoundsHash === boundsHash && this.precipCells.length > 0) {
      this.renderPrecip();
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.precipCells = cached;
      this.lastBoundsHash = boundsHash;
      this.renderPrecip();
      return;
    }

    this.requestInProgress = true;
    try {
      const points = generateGridPoints(bounds, rows, cols);
      const cells = await fetchGridPrecip(points, rows, cols, this.config);
      this.precipCells = cells;
      this.setCachedCells(boundsHash, cells);
      this.lastBoundsHash = boundsHash;
      this.renderPrecip();
    } catch (error) {
      console.error('Error rendering precip layer:', error);
    } finally {
      this.requestInProgress = false;
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
        console.warn('Error removing precip canvas layer:', error);
      }
    }
    this.canvasLayer = null;
    this.canvas = null;
    this.ctx = null;
    this.precipCells = [];
    this.lastBoundsHash = null;
    this.lastBounds = null;
    this.lastRows = 0;
    this.lastCols = 0;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
