import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  DEFAULT_TEMPERATURE_GRID_CONFIG,
  type MapBounds,
  type TemperatureCell,
  type TemperatureGridConfig,
  type TemperatureGridRenderOptions,
  calculateTemperatureGridDimensions,
  fetchGridTemperatures,
  generateTemperatureBoundsHash,
  generateTemperatureGridPoints,
} from './temperatureGridRenderer';
import {
  DEFAULT_WIND_FIELD_CONFIG,
  type WindFieldConfig,
  type WindFieldRenderOptions,
  type WindMapBounds,
  type WindVectorCell,
  calculateWindGridDimensions,
  fetchGridWind,
  generateWindBoundsHash,
  generateWindGridPoints,
} from './windFieldRenderer';
import {
  DEFAULT_CLOUD_LAYER_CONFIG,
  type CloudCell,
  type CloudLayerConfig,
  type CloudLayerRenderOptions,
  type CloudMapBounds,
  calculateCloudGridDimensions,
  fetchGridClouds,
  generateCloudBoundsHash,
  generateCloudGridPoints,
} from './cloudLayerRenderer';
import {
  DEFAULT_PRECIP_LAYER_CONFIG,
  type PrecipCell,
  type PrecipLayerConfig,
  type PrecipLayerRenderOptions,
  type PrecipMapBounds,
  calculatePrecipGridDimensions,
  fetchGridPrecip,
  generatePrecipBoundsHash,
  generatePrecipGridPoints,
  getPrecipColor,
} from './precipLayerRenderer';

type AnyBounds = MapBounds | WindMapBounds | CloudMapBounds | PrecipMapBounds;

abstract class MapLibreCanvasOverlayLayer {
  protected map: MapLibreMap;
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected layerName: string;

  constructor(map: MapLibreMap, layerName: string) {
    this.map = map;
    this.layerName = layerName;
  }

  setMapInstance(map: MapLibreMap): void {
    this.clear();
    this.map = map;
  }

  protected isValidMapInstance(): boolean {
    return !!this.map && !(this.map as any)._removed && !!this.map.getContainer();
  }

  protected ensureCanvasLayer(_bounds: AnyBounds): void {
    if (!this.isValidMapInstance()) return;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.dataset.weatherLayer = this.layerName;
      this.canvas.style.position = 'absolute';
      this.canvas.style.inset = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '1';
      this.ctx = this.canvas.getContext('2d');
      this.map.getContainer().appendChild(this.canvas);
    }
    if (!this.canvas || !this.ctx) return;

    this.updateCanvasSize();
  }

  protected updateCanvasSize(): void {
    if (!this.canvas) return;
    const container = this.map.getContainer();
    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const nextWidth = Math.max(1, Math.round(container.clientWidth * pixelRatio));
    const nextHeight = Math.max(1, Math.round(container.clientHeight * pixelRatio));
    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }
  }

  protected projectToCanvas(lon: number, lat: number): { x: number; y: number } | null {
    if (!this.canvas) return null;
    const container = this.map.getContainer();
    const point = this.map.project([lon, lat]);
    return {
      x: point.x * (this.canvas.width / Math.max(1, container.clientWidth)),
      y: point.y * (this.canvas.height / Math.max(1, container.clientHeight)),
    };
  }

  protected repaint(): void {
    this.map.triggerRepaint();
  }

  clear(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}

export class MapLibreTemperatureGridRenderer extends MapLibreCanvasOverlayLayer {
  private cache = new Map<string, { cells: TemperatureCell[]; timestamp: number }>();
  private config: TemperatureGridConfig;
  private requestInProgress = false;
  private lastBoundsHash: string | null = null;
  private progress = 0;

  constructor(map: MapLibreMap, config: Partial<TemperatureGridConfig> = {}) {
    super(map, 'temperature');
    this.config = { ...DEFAULT_TEMPERATURE_GRID_CONFIG, ...config };
  }

  private getCachedCells(boundsHash: string): TemperatureCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private renderCells(cells: TemperatureCell[], bounds: MapBounds, rows: number, cols: number): void {
    if (!this.ctx || !this.canvas) return;
    this.updateCanvasSize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const latDiff = bounds.northeast.lat - bounds.southwest.lat;
    const lngDiff = bounds.northeast.lng - bounds.southwest.lng;
    const cellLatHeight = latDiff / rows;
    const cellLngWidth = lngDiff / cols;

    cells.forEach((cell) => {
      let row = Math.floor((cell.lat - bounds.southwest.lat) / cellLatHeight);
      let col = Math.floor((cell.lon - bounds.southwest.lng) / cellLngWidth);
      row = Math.max(0, Math.min(rows - 1, row));
      col = Math.max(0, Math.min(cols - 1, col));

      const swLng = bounds.southwest.lng + col * cellLngWidth;
      const swLat = bounds.southwest.lat + row * cellLatHeight;
      const neLng = swLng + cellLngWidth;
      const neLat = swLat + cellLatHeight;
      const sw = this.projectToCanvas(swLng, swLat);
      const ne = this.projectToCanvas(neLng, neLat);
      if (!sw || !ne) return;

      this.ctx!.fillStyle = cell.color.replace('rgb(', 'rgba(').replace(')', ', 0.6)');
      this.ctx!.fillRect(
        Math.min(sw.x, ne.x) - 0.5,
        Math.min(sw.y, ne.y) - 0.5,
        Math.abs(ne.x - sw.x) + 1,
        Math.abs(ne.y - sw.y) + 1
      );
    });

    this.repaint();
  }

  async renderTemperatureGrid(bounds: MapBounds, options: TemperatureGridRenderOptions = {}): Promise<void> {
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

    const { rows, cols } = calculateTemperatureGridDimensions(bounds, this.config);
    const boundsHash = generateTemperatureBoundsHash(bounds, options.targetEpoch);
    this.ensureCanvasLayer(bounds);

    if (this.lastBoundsHash === boundsHash) {
      reportProgress(100);
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.renderCells(cached, bounds, rows, cols);
      this.lastBoundsHash = boundsHash;
      reportProgress(100);
      return;
    }

    this.requestInProgress = true;
    try {
      reportProgress(0);
      const points = generateTemperatureGridPoints(bounds, rows, cols);
      const cells = await fetchGridTemperatures(points, rows, cols, this.config, options.targetEpoch, (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 85) : 85;
        reportProgress(Math.min(85, percent));
      });
      reportProgress(90);
      this.cache.set(boundsHash, { cells, timestamp: Date.now() });
      this.renderCells(cells, bounds, rows, cols);
      this.lastBoundsHash = boundsHash;
      reportProgress(100);
    } catch (error) {
      console.error('Error rendering MapLibre temperature layer:', error);
    } finally {
      this.requestInProgress = false;
      if (this.progress < 100) reportProgress(100);
    }
  }

  clear(): void {
    super.clear();
    this.lastBoundsHash = null;
  }
}

export class MapLibreWindFieldRenderer extends MapLibreCanvasOverlayLayer {
  private cache = new Map<string, { cells: WindVectorCell[]; timestamp: number }>();
  private config: WindFieldConfig;
  private requestInProgress = false;
  private lastBoundsHash: string | null = null;
  private animationFrame: number | null = null;
  private progress = 0;
  private windCells: WindVectorCell[] = [];
  private currentBounds: WindMapBounds | null = null;
  private particlePhases: Float64Array = new Float64Array(0);
  private lastPhaseUpdate: number = 0;

  constructor(map: MapLibreMap, config: Partial<WindFieldConfig> = {}) {
    super(map, 'wind');
    this.config = { ...DEFAULT_WIND_FIELD_CONFIG, ...config };
  }

  private getCachedCells(boundsHash: string): WindVectorCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, headLength: number): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  private startAnimation(): void {
    if (!this.ctx || !this.canvas || !this.currentBounds) return;
    this.stopAnimation();
    const cycleMs = this.config.cycleDurationMs;
    const maxTravel = this.config.maxTravelPx;
    const fadeInEnd = 0.12;
    const fadeOutStart = 0.75;
    this.lastPhaseUpdate = 0;

    const animate = () => {
      if (!this.ctx || !this.canvas || !this.currentBounds) return;
      this.updateCanvasSize();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.lineCap = 'round';
      ctx.shadowBlur = 0;

      const drawEvery = Math.max(1, Math.ceil(this.windCells.length / this.config.maxDrawCount));
      const now = performance.now();
      const dt = this.lastPhaseUpdate ? now - this.lastPhaseUpdate : 16;
      this.lastPhaseUpdate = now;

      const itemCount = Math.ceil(this.windCells.length / drawEvery);
      if (this.particlePhases.length !== itemCount) {
        this.particlePhases = new Float64Array(itemCount);
        for (let j = 0; j < itemCount; j++) {
          this.particlePhases[j] = Math.random();
        }
      }

      for (let j = 0; j < itemCount; j++) {
        this.particlePhases[j] += dt / cycleMs;
        if (this.particlePhases[j] >= 1) {
          this.particlePhases[j] -= 1;
        }
      }

      let idx = 0;
      for (let i = 0; i < this.windCells.length; i += drawEvery) {
        const phase = this.particlePhases[idx];
        let alpha: number;
        if (phase < fadeInEnd) {
          alpha = phase / fadeInEnd;
        } else if (phase > fadeOutStart) {
          alpha = (1 - phase) / (1 - fadeOutStart);
        } else {
          alpha = 1;
        }
        idx++;

        if (alpha < 0.03) continue;

        const cell = this.windCells[i];
        const point = this.projectToCanvas(cell.lon, cell.lat);
        if (!point) continue;
        const speed = Math.max(0.1, cell.speed);
        const length = Math.min(this.config.maxLineLength, this.config.minLineLength + speed * 1.1);
        const magnitude = Math.sqrt(cell.u * cell.u + cell.v * cell.v);
        if (magnitude === 0) continue;
        const dirX = cell.u / magnitude;
        const dirY = -cell.v / magnitude;

        const travel = phase * maxTravel;
        const startX = point.x + dirX * travel;
        const startY = point.y + dirY * travel;
        const endX = startX + dirX * length;
        const endY = startY + dirY * length;
        const headLength = Math.max(2.5, length * 0.18);

        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(20, 35, 55, ${(alpha * 0.4).toFixed(2)})`;
        this.drawArrow(ctx, startX, startY, endX, endY, headLength);
        ctx.lineWidth = 1.15;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.9).toFixed(2)})`;
        this.drawArrow(ctx, startX, startY, endX, endY, headLength);
      }
      this.repaint();
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.lastPhaseUpdate = 0;
  }

  async renderWindField(bounds: WindMapBounds, options: WindFieldRenderOptions = {}): Promise<void> {
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

    this.currentBounds = bounds;
    this.ensureCanvasLayer(bounds);
    const boundsHash = generateWindBoundsHash(bounds, options.targetEpoch);
    if (this.lastBoundsHash === boundsHash && this.windCells.length > 0) {
      this.startAnimation();
      reportProgress(100);
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.windCells = cached;
      this.lastBoundsHash = boundsHash;
      this.startAnimation();
      reportProgress(100);
      return;
    }

    this.requestInProgress = true;
    try {
      reportProgress(0);
      const { rows, cols } = calculateWindGridDimensions(bounds, this.config);
      const points = generateWindGridPoints(bounds, rows, cols);
      const cells = await fetchGridWind(points, rows, cols, this.config, options.targetEpoch, (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 85) : 85;
        reportProgress(Math.min(85, percent));
      });
      reportProgress(90);
      this.windCells = cells;
      this.cache.set(boundsHash, { cells, timestamp: Date.now() });
      this.lastBoundsHash = boundsHash;
      this.startAnimation();
      reportProgress(100);
    } catch (error) {
      console.error('Error rendering MapLibre wind layer:', error);
    } finally {
      this.requestInProgress = false;
      if (this.progress < 100) reportProgress(100);
    }
  }

  clear(): void {
    this.stopAnimation();
    super.clear();
    this.windCells = [];
    this.currentBounds = null;
    this.lastBoundsHash = null;
    this.particlePhases = new Float64Array(0);
  }
}

export class MapLibreCloudLayerRenderer extends MapLibreCanvasOverlayLayer {
  private cache = new Map<string, { cells: CloudCell[]; timestamp: number }>();
  private config: CloudLayerConfig;
  private requestInProgress = false;
  private lastBoundsHash: string | null = null;
  private cloudCells: CloudCell[] = [];
  private progress = 0;
  private noiseCanvas: HTMLCanvasElement | null = null;
  private noisePattern: CanvasPattern | null = null;
  private noiseSeed = Math.random() * 1000;
  private lastBounds: CloudMapBounds | null = null;

  constructor(map: MapLibreMap, config: Partial<CloudLayerConfig> = {}) {
    super(map, 'cloud');
    this.config = { ...DEFAULT_CLOUD_LAYER_CONFIG, ...config };
  }

  setRenderStyle(style: 'soft' | 'noise'): void {
    this.config.renderStyle = style;
    this.noisePattern = null;
    this.renderClouds(this.lastBounds ?? undefined);
  }

  private getCachedCells(boundsHash: string): CloudCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private ensureNoisePattern(size: number): void {
    if (!this.ctx) return;
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
      const value = 120 + (seed / 233280) * 120;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    nctx.putImageData(imageData, 0, 0);
    this.noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
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

  private renderClouds(bounds?: CloudMapBounds): void {
    if (!this.ctx || !this.canvas || !bounds) return;
    this.updateCanvasSize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.config.renderStyle === 'noise' && !this.noisePattern) this.ensureNoisePattern(128);

    const drawEvery = Math.max(1, Math.ceil(this.cloudCells.length / this.config.maxDrawCount));
    for (let i = 0; i < this.cloudCells.length; i += drawEvery) {
      const cell = this.cloudCells[i];
      const cloud = Math.max(0, Math.min(100, cell.cloud));
      if (cloud < 5) continue;
      const point = this.projectToCanvas(cell.lon, cell.lat);
      if (!point) continue;
      const radius = 12 + (cloud / 100) * 20;
      const alpha = Math.min(0.55, 0.12 + (cloud / 100) * 0.6);
      if (this.config.renderStyle === 'noise' && this.noisePattern) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.ellipse(point.x, point.y, radius * 1.15, radius, 0, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.globalAlpha = alpha * 0.9;
        this.ctx.fillStyle = this.noisePattern;
        this.ctx.translate(point.x - radius, point.y - radius);
        this.ctx.fillRect(0, 0, radius * 2, radius * 2);
        this.ctx.restore();
      }
      this.drawCloudCell(this.ctx, point.x, point.y, radius, alpha * 0.6);
    }
    this.repaint();
  }

  async renderCloudLayer(bounds: CloudMapBounds, options: CloudLayerRenderOptions = {}): Promise<void> {
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

    this.ensureCanvasLayer(bounds);
    this.lastBounds = bounds;
    const boundsHash = generateCloudBoundsHash(bounds, options.targetEpoch);
    if (this.lastBoundsHash === boundsHash && this.cloudCells.length > 0) {
      this.renderClouds(bounds);
      reportProgress(100);
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.cloudCells = cached;
      this.lastBoundsHash = boundsHash;
      this.renderClouds(bounds);
      reportProgress(100);
      return;
    }

    this.requestInProgress = true;
    try {
      reportProgress(0);
      const { rows, cols } = calculateCloudGridDimensions(bounds, this.config);
      const points = generateCloudGridPoints(bounds, rows, cols);
      const cells = await fetchGridClouds(points, rows, cols, this.config, options.targetEpoch, (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 85) : 85;
        reportProgress(Math.min(85, percent));
      });
      reportProgress(90);
      this.cloudCells = cells;
      this.cache.set(boundsHash, { cells, timestamp: Date.now() });
      this.lastBoundsHash = boundsHash;
      this.renderClouds(bounds);
      reportProgress(100);
    } catch (error) {
      console.error('Error rendering MapLibre cloud layer:', error);
    } finally {
      this.requestInProgress = false;
      if (this.progress < 100) reportProgress(100);
    }
  }

  clear(): void {
    super.clear();
    this.cloudCells = [];
    this.lastBoundsHash = null;
    this.lastBounds = null;
    this.noiseCanvas = null;
    this.noisePattern = null;
  }
}

export class MapLibrePrecipLayerRenderer extends MapLibreCanvasOverlayLayer {
  private cache = new Map<string, { cells: PrecipCell[]; timestamp: number }>();
  private config: PrecipLayerConfig;
  private requestInProgress = false;
  private lastBoundsHash: string | null = null;
  private precipCells: PrecipCell[] = [];
  private progress = 0;

  constructor(map: MapLibreMap, config: Partial<PrecipLayerConfig> = {}) {
    super(map, 'precip');
    this.config = { ...DEFAULT_PRECIP_LAYER_CONFIG, ...config };
  }

  private getCachedCells(boundsHash: string): PrecipCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }
    return cached.cells;
  }

  private renderPrecip(cells: PrecipCell[], bounds: PrecipMapBounds, rows: number, cols: number): void {
    if (!this.ctx || !this.canvas) return;
    this.updateCanvasSize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const latDiff = bounds.northeast.lat - bounds.southwest.lat;
    const lngDiff = bounds.northeast.lng - bounds.southwest.lng;
    const cellLatHeight = latDiff / rows;
    const cellLngWidth = lngDiff / cols;

    cells.forEach((cell) => {
      const value = Math.max(0, cell.precip);
      if (value <= 0) return;
      let row = Math.floor((cell.lat - bounds.southwest.lat) / cellLatHeight);
      let col = Math.floor((cell.lon - bounds.southwest.lng) / cellLngWidth);
      row = Math.max(0, Math.min(rows - 1, row));
      col = Math.max(0, Math.min(cols - 1, col));
      const swLng = bounds.southwest.lng + col * cellLngWidth;
      const swLat = bounds.southwest.lat + row * cellLatHeight;
      const neLng = swLng + cellLngWidth;
      const neLat = swLat + cellLatHeight;
      const sw = this.projectToCanvas(swLng, swLat);
      const ne = this.projectToCanvas(neLng, neLat);
      if (!sw || !ne) return;
      this.ctx!.fillStyle = getPrecipColor(value);
      this.ctx!.fillRect(
        Math.min(sw.x, ne.x) - 0.5,
        Math.min(sw.y, ne.y) - 0.5,
        Math.abs(ne.x - sw.x) + 1,
        Math.abs(ne.y - sw.y) + 1
      );
    });
    this.repaint();
  }

  async renderPrecipLayer(bounds: PrecipMapBounds, options: PrecipLayerRenderOptions = {}): Promise<void> {
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

    this.ensureCanvasLayer(bounds);
    const { rows, cols } = calculatePrecipGridDimensions(bounds, this.config);
    const boundsHash = generatePrecipBoundsHash(bounds, options.targetEpoch);
    if (this.lastBoundsHash === boundsHash && this.precipCells.length > 0) {
      this.renderPrecip(this.precipCells, bounds, rows, cols);
      reportProgress(100);
      return;
    }

    const cached = this.getCachedCells(boundsHash);
    if (cached) {
      this.precipCells = cached;
      this.lastBoundsHash = boundsHash;
      this.renderPrecip(cached, bounds, rows, cols);
      reportProgress(100);
      return;
    }

    this.requestInProgress = true;
    try {
      reportProgress(0);
      const points = generatePrecipGridPoints(bounds, rows, cols);
      const cells = await fetchGridPrecip(points, rows, cols, this.config, options.targetEpoch, (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 85) : 85;
        reportProgress(Math.min(85, percent));
      });
      reportProgress(90);
      this.precipCells = cells;
      this.cache.set(boundsHash, { cells, timestamp: Date.now() });
      this.lastBoundsHash = boundsHash;
      this.renderPrecip(cells, bounds, rows, cols);
      reportProgress(100);
    } catch (error) {
      console.error('Error rendering MapLibre precip layer:', error);
    } finally {
      this.requestInProgress = false;
      if (this.progress < 100) reportProgress(100);
    }
  }

  clear(): void {
    super.clear();
    this.precipCells = [];
    this.lastBoundsHash = null;
  }
}
