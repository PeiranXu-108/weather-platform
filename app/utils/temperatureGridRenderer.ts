import { getTemperatureColor } from './utils';

/**
 * 温度网格单元格的温度数据
 */
export interface TemperatureCell {
  lat: number;
  lon: number;
  temp: number;
  color: string;
}

/**
 * 网格缓存项
 */
interface GridCacheItem {
  cells: TemperatureCell[];
  timestamp: number;
}

/**
 * 地图边界对象
 */
interface MapBounds {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
}

/**
 * 温度网格渲染器配置
 */
export interface TemperatureGridConfig {
  minGridCells: number; // 最小网格数量
  maxGridCells: number; // 最大网格数量
  cacheExpiry: number; // 缓存过期时间（毫秒）
  apiRequestDelay: number; // API请求延迟（毫秒）
}

const DEFAULT_CONFIG: TemperatureGridConfig = {
  minGridCells: 15, // 3x5
  maxGridCells: 1500, // 30x50
  cacheExpiry: 5 * 60 * 1000, // 5分钟
  apiRequestDelay: 100, // 100ms
};

/**
 * 生成网格边界哈希值用于缓存
 */
function generateBoundsHash(bounds: MapBounds): string {
  return `${bounds.northeast.lat.toFixed(4)}_${bounds.northeast.lng.toFixed(4)}_${bounds.southwest.lat.toFixed(4)}_${bounds.southwest.lng.toFixed(4)}`;
}

/**
 * 计算合适的网格行数和列数
 * 考虑最小/最大约束和地图纵横比
 */
function calculateGridDimensions(
  bounds: MapBounds,
  config: TemperatureGridConfig
): { rows: number; cols: number } {
  const latDiff = Math.abs(bounds.northeast.lat - bounds.southwest.lat);
  const lngDiff = Math.abs(bounds.northeast.lng - bounds.southwest.lng);
  const aspectRatio = lngDiff / latDiff;

  // 减少网格密度以提高性能
  // 改为更稀疏的网格：最多 100-150 个单元格
  const maxCells = 150;
  const baseGridSize = Math.sqrt(maxCells / 2);

  // 计算理想的行列数
  let cols = Math.ceil(Math.sqrt(baseGridSize * baseGridSize * aspectRatio));
  let rows = Math.ceil(Math.sqrt(baseGridSize * baseGridSize / aspectRatio));

  // 应用最小约束
  if (rows < 3) rows = 3;
  if (cols < 5) cols = 5;

  // 应用最大约束
  const totalCells = rows * cols;
  if (totalCells > maxCells) {
    const scale = Math.sqrt(maxCells / totalCells);
    rows = Math.max(3, Math.floor(rows * scale));
    cols = Math.max(5, Math.floor(cols * scale));
  }

  return { rows, cols };
}

/**
 * 生成网格坐标点
 */
function generateGridPoints(
  bounds: MapBounds,
  rows: number,
  cols: number
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [];

  const latDiff = bounds.northeast.lat - bounds.southwest.lat;
  const lngDiff = bounds.northeast.lng - bounds.southwest.lng;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // 计算网格点的比例位置（0-1）
      const latRatio = (i + 0.5) / rows;
      const lngRatio = (j + 0.5) / cols;

      // 转换为实际坐标
      const lat = bounds.southwest.lat + latDiff * latRatio;
      const lon = bounds.southwest.lng + lngDiff * lngRatio;

      points.push({ lat, lon });
    }
  }

  return points;
}

/**
 * 获取单个点的温度数据
 */
async function fetchTemperature(lat: number, lon: number): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3秒超时

    const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&lang=zh`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.current?.temp_c || null;
  } catch (error) {
    return null;
  }
}

/**
 * 批量获取网格点的温度数据
 * 使用并发请求以提高性能
 */
async function fetchGridTemperatures(
  points: Array<{ lat: number; lon: number }>,
  delay: number = DEFAULT_CONFIG.apiRequestDelay
): Promise<TemperatureCell[]> {
  const cells: TemperatureCell[] = [];

  // 使用并发请求，限制并发数为 8
  const concurrencyLimit = 8;
  const chunks: Array<Array<{ lat: number; lon: number }>> = [];
  
  for (let i = 0; i < points.length; i += concurrencyLimit) {
    chunks.push(points.slice(i, i + concurrencyLimit));
  }

  console.log(
    `[fetchGridTemperatures] Processing ${points.length} points in ${chunks.length} batches (limit: ${concurrencyLimit})`
  );

  for (const chunk of chunks) {
    const promises = chunk.map(point => fetchTemperature(point.lat, point.lon));
    const results = await Promise.all(promises);

    results.forEach((temp, index) => {
      const point = chunk[index];
      if (temp !== null) {
        const color = getTemperatureColor(temp);
        cells.push({
          lat: point.lat,
          lon: point.lon,
          temp,
          color,
        });
      }
    });
  }

  console.log(`[fetchGridTemperatures] Successfully fetched ${cells.length}/${points.length} cells`);
  return cells;
}

/**
 * 温度网格渲染器类
 */
export class TemperatureGridRenderer {
  private cache: Map<string, GridCacheItem> = new Map();
  private config: TemperatureGridConfig;
  private amap: any;
  private rectangles: any[] = [];
  private requestInProgress: boolean = false;
  private lastBoundsHash: string | null = null;

  constructor(amap: any, config: Partial<TemperatureGridConfig> = {}) {
    this.amap = amap;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取有效的缓存，如果超时返回null
   */
  private getCachedCells(boundsHash: string): TemperatureCell[] | null {
    const cached = this.cache.get(boundsHash);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheExpiry) {
      this.cache.delete(boundsHash);
      return null;
    }

    return cached.cells;
  }

  /**
   * 设置缓存
   */
  private setCachedCells(boundsHash: string, cells: TemperatureCell[]): void {
    this.cache.set(boundsHash, {
      cells,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除所有矩形图层
   */
  private clearRectangles(): void {
    this.rectangles.forEach((rect) => {
      try {
        // 先尝试移除
        if (rect && this.amap) {
          this.amap.remove(rect);
          // 也可以尝试设置 map 为 null
          if (rect.setMap) {
            rect.setMap(null);
          }
        }
      } catch (error) {
        console.warn('Error removing rectangle:', error);
      }
    });
    this.rectangles = [];
  }

  /**
   * 创建单个网格单元格的矩形
   */
  private createCell(
    bounds: MapBounds,
    rows: number,
    cols: number,
    row: number,
    col: number,
    cell: TemperatureCell
  ): any {
    const latDiff = bounds.northeast.lat - bounds.southwest.lat;
    const lngDiff = bounds.northeast.lng - bounds.southwest.lng;

    // 计算网格单元的边界
    const cellLatHeight = latDiff / rows;
    const cellLngWidth = lngDiff / cols;

    const swLng = bounds.southwest.lng + col * cellLngWidth;
    const swLat = bounds.southwest.lat + row * cellLatHeight;
    const neLng = bounds.southwest.lng + (col + 1) * cellLngWidth;
    const neLat = bounds.southwest.lat + (row + 1) * cellLatHeight;

    // 验证坐标有效性
    if (isNaN(swLng) || isNaN(swLat) || isNaN(neLng) || isNaN(neLat)) {
      console.warn('Invalid cell bounds:', { swLng, swLat, neLng, neLat, row, col });
      return null;
    }

    const sw = new window.AMap.LngLat(swLng, swLat);
    const ne = new window.AMap.LngLat(neLng, neLat);

    // 创建 Bounds 对象
    const cellBounds = new window.AMap.Bounds(sw, ne);

    // 创建 Rectangle 对象，不直接设置 map（稍后通过 add 方法添加）
    const rectangle = new window.AMap.Rectangle({
      bounds: cellBounds,
      strokeColor: cell.color,
      strokeWeight: 0,
      fillColor: cell.color,
      fillOpacity: 0.6, // 60% 透明度
      zIndex: 100, // 提高 zIndex 确保显示在地图图层之上
      cursor: 'default', // 设置鼠标样式
    });

    return rectangle;
  }

  /**
   * 渲染温度网格
   */
  async renderTemperatureGrid(bounds: MapBounds): Promise<void> {
    // 避免重复请求
    if (this.requestInProgress) {
      console.log('Request already in progress, skipping');
      return;
    }

    const boundsHash = generateBoundsHash(bounds);
    console.log('renderTemperatureGrid called with bounds:', bounds, 'hash:', boundsHash);

    // 如果边界没有变化且矩形已存在，不重新渲染
    if (this.lastBoundsHash === boundsHash && this.rectangles.length > 0) {
      console.log('Bounds unchanged and rectangles exist, skipping');
      return;
    }

    // 检查缓存
    let cells = this.getCachedCells(boundsHash);
    if (cells) {
      console.log('Using cached cells:', cells.length);
      this.clearRectangles();
      this._renderCells(cells, bounds);
      this.lastBoundsHash = boundsHash;
      return;
    }

    // 执行新的请求
    this.requestInProgress = true;
    try {
      const { rows, cols } = calculateGridDimensions(bounds, this.config);
      const points = generateGridPoints(bounds, rows, cols);

      console.log(`Fetching temperature for ${points.length} grid points (${rows}x${cols})`);

      cells = await fetchGridTemperatures(points, this.config.apiRequestDelay);
      
      console.log(`Fetched ${cells.length} cells with temperature data`);

      // 缓存结果
      this.setCachedCells(boundsHash, cells);

      // 渲染网格
      this.clearRectangles();
      this._renderCells(cells, bounds, rows, cols);

      this.lastBoundsHash = boundsHash;
      console.log('Temperature grid render completed successfully');
    } catch (error) {
      console.error('Error rendering temperature grid:', error);
    } finally {
      this.requestInProgress = false;
    }
  }

  /**
   * 内部方法：渲染网格单元格
   */
  private _renderCells(
    cells: TemperatureCell[],
    bounds: MapBounds,
    rows?: number,
    cols?: number
  ): void {
    if (!rows || !cols) {
      // 如果未提供行列数，使用默认值
      const dims = calculateGridDimensions(bounds, this.config);
      rows = dims.rows;
      cols = dims.cols;
    }

    this.clearRectangles();

    console.log(`[_renderCells] Rendering ${cells.length} cells with grid ${rows}x${cols}`);

    // 创建并添加所有矩形
    cells.forEach((cell) => {
      // 根据温度坐标计算其在网格中的位置
      const latDiff = bounds.northeast.lat - bounds.southwest.lat;
      const lngDiff = bounds.northeast.lng - bounds.southwest.lng;

      const cellLatHeight = latDiff / rows!;
      const cellLngWidth = lngDiff / cols!;

      const row = Math.floor((cell.lat - bounds.southwest.lat) / cellLatHeight);
      const col = Math.floor((cell.lon - bounds.southwest.lng) / cellLngWidth);

      // 确保行列索引有效
      if (row >= 0 && row < rows! && col >= 0 && col < cols!) {
        const rectangle = this.createCell(bounds, rows!, cols!, row, col, cell);
        
        // 如果 createCell 返回 null（无效的 bounds），跳过
        if (!rectangle) {
          return;
        }
        
        // 确保地图实例存在后再添加
        if (this.amap && rectangle) {
          try {
            // 优先使用 setMap 方法（AMap API 推荐方式）
            if (rectangle.setMap && typeof rectangle.setMap === 'function') {
              rectangle.setMap(this.amap);
            } else {
              // 如果 setMap 不可用，使用 add 方法
              this.amap.add(rectangle);
            }
            // 确保矩形可见
            if (rectangle.show && typeof rectangle.show === 'function') {
              rectangle.show();
            }
            this.rectangles.push(rectangle);
          } catch (error) {
            console.error('Error adding rectangle to map:', error, {
              rectangle,
              amap: !!this.amap,
              hasSetMap: rectangle.setMap !== undefined,
              hasAdd: this.amap.add !== undefined
            });
          }
        }
      }
    });

    console.log(`[_renderCells] Successfully rendered ${this.rectangles.length} rectangles`);
  }

  /**
   * 清除所有网格图层
   */
  clear(): void {
    this.clearRectangles();
    this.lastBoundsHash = null;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * 便捷函数：创建并渲染温度网格
 */
export async function renderTemperatureGridOnMap(
  amap: any,
  bounds: MapBounds,
  config?: Partial<TemperatureGridConfig>
): Promise<TemperatureGridRenderer> {
  const renderer = new TemperatureGridRenderer(amap, config);
  await renderer.renderTemperatureGrid(bounds);
  return renderer;
}
