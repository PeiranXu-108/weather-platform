import { getTemperatureColor } from './utils';
import { fetchWeatherPoint } from './weatherPointCache';

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
  zoom?: number; // 可选的地图缩放级别
}

export interface TemperatureGridRenderOptions {
  onProgress?: (progress: number) => void;
}

/**
 * 温度网格渲染器配置
 */
export interface TemperatureGridConfig {
  minGridCells: number; // 最小网格数量
  maxGridCells: number; // 最大网格数量
  cacheExpiry: number; // 缓存过期时间（毫秒）
  apiRequestDelay: number; // API请求延迟（毫秒）
  samplingRatio: number; // 采样比例（0-1），1表示全部采样，0.25表示只采样25%的点
  enableInterpolation: boolean; // 是否启用插值算法
}

const DEFAULT_CONFIG: TemperatureGridConfig = {
  minGridCells: 30, // 5x6，提高最小网格数
  maxGridCells: 2000, // 增加到2000个网格，提供更细致的渲染
  cacheExpiry: 3 * 60 * 1000, // 5分钟
  apiRequestDelay: 100,
  samplingRatio: 0.2, // 降低到20%采样，因为网格更多，插值算法可以处理
  enableInterpolation: true, // 默认启用插值
};

/**
 * 生成网格边界哈希值用于缓存
 */
function generateBoundsHash(bounds: MapBounds): string {
  return `${bounds.northeast.lat.toFixed(4)}_${bounds.northeast.lng.toFixed(4)}_${bounds.southwest.lat.toFixed(4)}_${bounds.southwest.lng.toFixed(4)}`;
}

/**
 * 根据缩放级别计算动态网格密度
 * 缩放级别越高（地图越放大），网格越密集
 */
function calculateDynamicMaxCells(zoom?: number, baseMaxCells: number = 2000): number {
  if (!zoom) {
    return baseMaxCells;
  }

  // 缩放级别范围通常是 3-20
  // 缩放级别越高，网格越密集
  // 公式：maxCells = baseMaxCells * (zoom / 10)^2
  // 这样在 zoom=10 时，maxCells = baseMaxCells
  // 在 zoom=15 时，maxCells ≈ baseMaxCells * 2.25
  // 在 zoom=5 时，maxCells ≈ baseMaxCells * 0.25
  
  const zoomFactor = Math.pow(Math.max(3, Math.min(20, zoom)) / 10, 1.5);
  const dynamicMaxCells = Math.floor(baseMaxCells * zoomFactor);
  
  // 限制在合理范围内
  return Math.max(100, Math.min(5000, dynamicMaxCells));
}

/**
 * 计算合适的网格行数和列数
 * 考虑最小/最大约束和地图纵横比
 * 增加网格密度以提供更细致的渲染
 * 根据缩放级别动态调整密度
 */
function calculateGridDimensions(
  bounds: MapBounds,
  config: TemperatureGridConfig
): { rows: number; cols: number } {
  const latDiff = Math.abs(bounds.northeast.lat - bounds.southwest.lat);
  const lngDiff = Math.abs(bounds.northeast.lng - bounds.southwest.lng);
  const aspectRatio = lngDiff / latDiff;

  // 根据缩放级别动态调整最大网格数
  const maxCells = calculateDynamicMaxCells(bounds.zoom, config.maxGridCells);
  
  // 计算基础网格大小（基于最大网格数和纵横比）
  // 使用更大的基础值以获得更密集的网格
  const baseGridSize = Math.sqrt(maxCells / aspectRatio);

  // 计算理想的行列数（基于纵横比）
  let cols = Math.ceil(Math.sqrt(baseGridSize * baseGridSize * aspectRatio));
  let rows = Math.ceil(Math.sqrt(baseGridSize * baseGridSize / aspectRatio));

  // 应用最小约束（提高最小网格数以获得更细致的渲染）
  const minRows = Math.ceil(Math.sqrt(config.minGridCells / aspectRatio));
  const minCols = Math.ceil(Math.sqrt(config.minGridCells * aspectRatio));
  if (rows < minRows) rows = minRows;
  if (cols < minCols) cols = minCols;

  // 应用最大约束
  const totalCells = rows * cols;
  if (totalCells > maxCells) {
    const scale = Math.sqrt(maxCells / totalCells);
    rows = Math.max(minRows, Math.floor(rows * scale));
    cols = Math.max(minCols, Math.floor(cols * scale));
  }

  const finalCells = rows * cols;
  if (finalCells < config.minGridCells) {
    // 如果计算出的网格数太少，增加密度
    const scale = Math.sqrt(config.minGridCells / finalCells);
    rows = Math.ceil(rows * scale);
    cols = Math.ceil(cols * scale);
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
): Array<{ lat: number; lon: number; row: number; col: number }> {
  const points: Array<{ lat: number; lon: number; row: number; col: number }> = [];

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

      points.push({ lat, lon, row: i, col: j });
    }
  }

  return points;
}

/**
 * 计算两点之间的距离（使用 Haversine 公式的简化版本，适用于小范围）
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球半径（公里）
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

/**
 * IDW（反距离加权）插值算法
 * 根据已知采样点的温度，估算目标点的温度
 * 改进版：确保即使采样点较少也能插值，添加最大搜索距离限制
 */
function interpolateTemperature(
  targetLat: number,
  targetLon: number,
  samplePoints: Array<{ lat: number; lon: number; temp: number }>,
  power: number = 2, // 距离的幂次，通常为2
  maxSearchDistance: number = 500 // 最大搜索距离（公里），超过此距离的采样点不参与插值
): number | null {
  if (samplePoints.length === 0) {
    return null;
  }

  // 如果目标点正好是采样点，直接返回
  for (const point of samplePoints) {
    if (
      Math.abs(point.lat - targetLat) < 0.0001 &&
      Math.abs(point.lon - targetLon) < 0.0001
    ) {
      return point.temp;
    }
  }

  // 计算所有采样点的距离，并过滤掉距离过远的点
  const pointsWithDistance = samplePoints
    .map((point) => {
      const distance = calculateDistance(
        targetLat,
        targetLon,
        point.lat,
        point.lon
      );
      return { ...point, distance };
    })
    .filter((p) => p.distance <= maxSearchDistance)
    .sort((a, b) => a.distance - b.distance); // 按距离排序

  // 如果没有有效的采样点，使用最近的采样点（即使超过最大距离）
  if (pointsWithDistance.length === 0) {
    const allDistances = samplePoints.map((point) => ({
      ...point,
      distance: calculateDistance(targetLat, targetLon, point.lat, point.lon),
    }));
    const nearest = allDistances.reduce((min, p) =>
      p.distance < min.distance ? p : min
    );
    return nearest.temp; // 直接返回最近点的温度
  }

  // 如果只有一个采样点，直接返回
  if (pointsWithDistance.length === 1) {
    return pointsWithDistance[0].temp;
  }

  let weightedSum = 0;
  let weightSum = 0;
  const minDistance = 0.001; // 最小距离阈值，避免除零

  // 使用最近的N个点进行插值（最多使用10个最近的采样点，提高性能）
  const nearestPoints = pointsWithDistance.slice(0, Math.min(10, pointsWithDistance.length));

  for (const point of nearestPoints) {
    // 如果距离太近，直接返回该点的温度
    if (point.distance < minDistance) {
      return point.temp;
    }

    // IDW权重：1 / distance^power
    const weight = 1 / Math.pow(point.distance, power);
    weightedSum += weight * point.temp;
    weightSum += weight;
  }

  if (weightSum === 0) {
    // 如果权重和为0，返回最近点的温度
    return nearestPoints[0].temp;
  }

  return weightedSum / weightSum;
}

/**
 * 智能采样：根据采样比例选择关键采样点
 * 使用网格采样策略，确保采样点均匀分布
 */
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
    // 全部采样
    const indices = new Set(allPoints.map((_, i) => i));
    return { samplePoints: allPoints, sampleIndices: indices };
  }

  // 计算采样间隔
  const sampleInterval = Math.max(1, Math.floor(1 / samplingRatio));
  
  // 网格采样：每隔 sampleInterval 个点采样一次
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

  // 确保边界点也被采样（提高插值精度）
  const boundaryIndices = [
    0, // 左上角
    cols - 1, // 右上角
    (rows - 1) * cols, // 左下角
    rows * cols - 1, // 右下角
  ];

  boundaryIndices.forEach((idx) => {
    if (idx < allPoints.length && !sampleIndices.has(idx)) {
      samplePoints.push(allPoints[idx]);
      sampleIndices.add(idx);
    }
  });

  // 确保中心点也被采样（提高中心区域的插值精度）
  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const centerIndex = centerRow * cols + centerCol;
  if (centerIndex < allPoints.length && !sampleIndices.has(centerIndex)) {
    samplePoints.push(allPoints[centerIndex]);
    sampleIndices.add(centerIndex);
  }

  // 确保四边的中点也被采样（提高边界区域的插值精度）
  const edgeIndices = [
    Math.floor(rows / 2) * cols + 0, // 左中点
    Math.floor(rows / 2) * cols + (cols - 1), // 右中点
    0 * cols + Math.floor(cols / 2), // 上中点
    (rows - 1) * cols + Math.floor(cols / 2), // 下中点
  ];

  edgeIndices.forEach((idx) => {
    if (idx < allPoints.length && !sampleIndices.has(idx)) {
      samplePoints.push(allPoints[idx]);
      sampleIndices.add(idx);
    }
  });

  return { samplePoints, sampleIndices };
}

/**
 * 获取单个点的温度数据
 */
async function fetchTemperature(lat: number, lon: number): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3秒超时
    const data = await fetchWeatherPoint(lat, lon, controller.signal);
    clearTimeout(timeout);
    return data?.current?.temp_c ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * 并发控制函数：限制同时执行的 Promise 数量
 * 使用滑动窗口的方式，当一个任务完成时立即开始下一个任务
 */
async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{ success: boolean; result: T | null; index: number }>> {
  if (tasks.length === 0) {
    return [];
  }

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
    if (currentIndex >= tasks.length) {
      return Promise.resolve();
    }

    const taskIndex = currentIndex++;
    const promise = run(taskIndex).then(() => {
      // 从执行队列中移除
      const promiseIndex = executing.indexOf(promise);
      if (promiseIndex > -1) {
        executing.splice(promiseIndex, 1);
      }
      // 继续处理下一个任务
      return enqueue();
    });

    executing.push(promise);
    return promise;
  };

  // 启动初始批次（最多 limit 个并发任务）
  const initialCount = Math.min(limit, tasks.length);
  for (let i = 0; i < initialCount; i++) {
    enqueue();
  }

  // 等待所有任务完成
  await Promise.all(executing);

  // 确保所有结果都已收集（按索引排序）
  return results.sort((a, b) => a.index - b.index);
}

/**
 * 根据网格密度动态调整采样比例
 * 网格越密集，采样比例可以稍微提高以保持插值精度
 */
function calculateDynamicSamplingRatio(
  totalPoints: number,
  baseSamplingRatio: number
): number {
  // 如果网格点少于200个，使用基础采样比例
  if (totalPoints < 200) {
    return baseSamplingRatio;
  }
  
  // 如果网格点很多（>1000），稍微提高采样比例以保持精度
  // 但不超过0.3（30%），避免请求过多
  if (totalPoints > 1000) {
    return Math.min(0.3, baseSamplingRatio * 1.2);
  }
  
  // 中等密度网格，稍微提高采样比例
  return Math.min(0.25, baseSamplingRatio * 1.1);
}

/**
 * 批量获取网格点的温度数据
 * 使用智能采样 + IDW插值算法，大幅减少API请求数量
 */
async function fetchGridTemperatures(
  allPoints: Array<{ lat: number; lon: number; row: number; col: number }>,
  rows: number,
  cols: number,
  config: TemperatureGridConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<TemperatureCell[]> {
  const startTime = Date.now();
  const concurrencyLimit = 20;

  // 根据网格密度动态调整采样比例
  const baseSamplingRatio = config.enableInterpolation ? config.samplingRatio : 1.0;
  const samplingRatio = config.enableInterpolation 
    ? calculateDynamicSamplingRatio(allPoints.length, baseSamplingRatio)
    : 1.0;

  // 选择采样点
  const { samplePoints, sampleIndices } = selectSamplePoints(
    allPoints,
    samplingRatio,
    rows,
    cols
  );

  // 只请求采样点的温度数据
  const tasks = samplePoints.map((point) => async () => {
    return await fetchTemperature(point.lat, point.lon);
  });

  onProgress?.(0, samplePoints.length);
  const results = await pLimit(tasks, concurrencyLimit, onProgress);

  // 收集采样点的温度数据，并创建索引映射
  const sampleTemperatures: Array<{
    lat: number;
    lon: number;
    temp: number;
  }> = [];
  
  // 创建采样点索引到温度值的映射
  const sampleTempMap = new Map<number, number>();

  samplePoints.forEach((point, index) => {
    const result = results[index];
    if (result.success && result.result !== null) {
      const pointIndex = point.row * cols + point.col;
      sampleTemperatures.push({
        lat: point.lat,
        lon: point.lon,
        temp: result.result,
      });
      // 建立索引映射
      sampleTempMap.set(pointIndex, result.result);
    }
  });

  // 如果采样点太少，警告并建议提高采样比例
  if (sampleTemperatures.length < samplePoints.length * 0.5) {
    console.warn(
      `[fetchGridTemperatures] Low success rate: ${sampleTemperatures.length}/${samplePoints.length} (${((sampleTemperatures.length / samplePoints.length) * 100).toFixed(1)}%) sample points fetched successfully`
    );
  }

  // 如果采样点数量不足，无法进行有效插值
  if (config.enableInterpolation && sampleTemperatures.length < 3) {
    console.warn(
      `[fetchGridTemperatures] Too few sample points (${sampleTemperatures.length}) for interpolation, some areas may not render`
    );
  }

  // 如果启用插值，为所有点计算温度
  const cells: TemperatureCell[] = [];
  
  if (config.enableInterpolation && sampleTemperatures.length > 0) {
    // 使用IDW插值算法估算所有点的温度
    // 确保每个网格点都有对应的温度数据
    allPoints.forEach((point) => {
      const pointIndex = point.row * cols + point.col;
      let temp: number | null = null;

      if (sampleIndices.has(pointIndex)) {
        // 如果是采样点，直接从映射中获取
        temp = sampleTempMap.get(pointIndex) || null;
      } else {
        // 使用IDW插值估算
        temp = interpolateTemperature(
          point.lat,
          point.lon,
          sampleTemperatures
        );
      }

      // 如果插值失败，尝试使用最近的采样点
      if (temp === null && sampleTemperatures.length > 0) {
        const distances = sampleTemperatures.map((sp) => ({
          ...sp,
          distance: calculateDistance(point.lat, point.lon, sp.lat, sp.lon),
        }));
        const nearest = distances.reduce((min, p) =>
          p.distance < min.distance ? p : min
        );
        temp = nearest.temp;
      }

      // 确保每个点都有温度数据
      if (temp !== null) {
        const color = getTemperatureColor(temp);
        cells.push({
          lat: point.lat,
          lon: point.lon,
          temp,
          color,
        });
      } else {
        // 如果仍然没有数据，记录警告
        console.warn(
          `[fetchGridTemperatures] Failed to get temperature for point (${point.lat}, ${point.lon}), row: ${point.row}, col: ${point.col}`
        );
      }
    });
  } else {
    // 不使用插值，只返回采样点
    sampleTemperatures.forEach((sample) => {
      const color = getTemperatureColor(sample.temp);
      cells.push({
        lat: sample.lat,
        lon: sample.lon,
        temp: sample.temp,
        color,
      });
    });
  }

  // 检查是否有缺失的网格点
  const expectedCells = rows * cols;
  if (cells.length < expectedCells) {
    console.warn(
      `[fetchGridTemperatures] Missing cells: expected ${expectedCells}, got ${cells.length} (${((cells.length / expectedCells) * 100).toFixed(1)}%)`
    );
  }

  const duration = Date.now() - startTime;
  const reduction = ((1 - samplePoints.length / allPoints.length) * 100).toFixed(1);

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
  private progress: number = 0;

  constructor(amap: any, config: Partial<TemperatureGridConfig> = {}) {
    if (!amap) {
      console.warn('TemperatureGridRenderer: Map instance is required');
    }
    this.amap = amap;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新地图实例（当地图重新初始化时调用）
   */
  setMapInstance(amap: any): void {
    // 清除旧的矩形
    this.clearRectangles();
    // 更新地图实例
    this.amap = amap;
    // 清除缓存，因为地图实例变了
    this.lastBoundsHash = null;
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
      zIndex: 60, // 保持在底图之上，但低于地名标注
      cursor: 'default', // 设置鼠标样式
    });

    return rectangle;
  }

  /**
   * 渲染温度网格
   */
  async renderTemperatureGrid(
    bounds: MapBounds,
    options: TemperatureGridRenderOptions = {}
  ): Promise<void> {
    const reportProgress = (value: number) => {
      this.progress = value;
      options.onProgress?.(value);
    };

    // 首先检查地图实例是否有效
    if (!this.isValidMapInstance()) {
      console.warn('renderTemperatureGrid: Map instance is not valid, skipping');
      reportProgress(100);
      return;
    }

    // 避免重复请求
    if (this.requestInProgress) {
      options.onProgress?.(this.progress);
      return;
    }

    const boundsHash = generateBoundsHash(bounds);

    // 如果边界没有变化且矩形已存在，不重新渲染
    if (this.lastBoundsHash === boundsHash && this.rectangles.length > 0) {
      reportProgress(100);
      return;
    }

    // 检查缓存
    let cells = this.getCachedCells(boundsHash);
    if (cells) {
      this.clearRectangles();
      this._renderCells(cells, bounds);
      this.lastBoundsHash = boundsHash;
      reportProgress(100);
      return;
    }

    // 执行新的请求
    this.requestInProgress = true;
    try {
      reportProgress(0);
      const { rows, cols } = calculateGridDimensions(bounds, this.config);
      const points = generateGridPoints(bounds, rows, cols);

      // 使用智能采样 + 插值算法
      cells = await fetchGridTemperatures(points, rows, cols, this.config, (completed, total) => {
        const percent = total > 0 ? Math.round((completed / total) * 85) : 85;
        reportProgress(Math.min(85, percent));
      });
      

      // 缓存结果
      this.setCachedCells(boundsHash, cells);

      // 渲染网格
      reportProgress(90);
      this.clearRectangles();
      this._renderCells(cells, bounds, rows, cols);
      reportProgress(100);

      this.lastBoundsHash = boundsHash;
    } catch (error) {
      console.error('Error rendering temperature grid:', error);
    } finally {
      this.requestInProgress = false;
      if (this.progress < 100) {
        reportProgress(100);
      }
    }
  }

  /**
   * 检查地图实例是否有效
   */
  private isValidMapInstance(): boolean {
    if (!this.amap) {
      return false;
    }
    
    // 检查地图实例是否有必要的方法
    if (typeof this.amap.add !== 'function' && typeof this.amap.remove !== 'function') {
      return false;
    }
    
    // 尝试获取地图容器，如果失败说明地图实例无效
    try {
      const container = this.amap.getContainer?.();
      if (!container) {
        return false;
      }
    } catch (error) {
      return false;
    }
    
    return true;
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
    // 首先检查地图实例是否有效
    if (!this.isValidMapInstance()) {
      console.warn('[_renderCells] Map instance is not valid, skipping rendering');
      return;
    }

    if (!rows || !cols) {
      // 如果未提供行列数，使用默认值
      const dims = calculateGridDimensions(bounds, this.config);
      rows = dims.rows;
      cols = dims.cols;
    }

    this.clearRectangles();

    // 创建并添加所有矩形
    // 使用 Map 来跟踪已渲染的单元格，避免重复渲染
    const renderedCells = new Map<string, boolean>();
    let successCount = 0;
    let failCount = 0;

    cells.forEach((cell) => {
      // 再次检查地图实例（可能在循环过程中失效）
      if (!this.isValidMapInstance()) {
        console.warn('[_renderCells] Map instance became invalid during rendering');
        return;
      }

      // 根据温度坐标计算其在网格中的位置
      const latDiff = bounds.northeast.lat - bounds.southwest.lat;
      const lngDiff = bounds.northeast.lng - bounds.southwest.lng;

      const cellLatHeight = latDiff / rows!;
      const cellLngWidth = lngDiff / cols!;

      // 使用更精确的计算方法，避免边界问题
      let row = Math.floor((cell.lat - bounds.southwest.lat) / cellLatHeight);
      let col = Math.floor((cell.lon - bounds.southwest.lng) / cellLngWidth);

      // 边界处理：确保索引在有效范围内
      row = Math.max(0, Math.min(rows! - 1, row));
      col = Math.max(0, Math.min(cols! - 1, col));

      // 创建唯一键，避免重复渲染同一单元格
      const cellKey = `${row}_${col}`;
      if (renderedCells.has(cellKey)) {
        return; // 已经渲染过这个单元格
      }

      // 确保行列索引有效
      if (row >= 0 && row < rows! && col >= 0 && col < cols!) {
        const rectangle = this.createCell(bounds, rows!, cols!, row, col, cell);
        
        // 如果 createCell 返回 null（无效的 bounds），跳过
        if (!rectangle) {
          failCount++;
          return;
        }
        
        // 确保地图实例存在且有效后再添加
        if (this.amap && rectangle && this.isValidMapInstance()) {
          try {
            // 优先使用 add 方法（更可靠）
            if (this.amap.add && typeof this.amap.add === 'function') {
              this.amap.add(rectangle);
              if (rectangle.show && typeof rectangle.show === 'function') {
                rectangle.show();
              }
              this.rectangles.push(rectangle);
              renderedCells.set(cellKey, true);
              successCount++;
            } else if (rectangle.setMap && typeof rectangle.setMap === 'function') {
              // 如果 add 不可用，尝试使用 setMap
              rectangle.setMap(this.amap);
              if (rectangle.show && typeof rectangle.show === 'function') {
                rectangle.show();
              }
              this.rectangles.push(rectangle);
              renderedCells.set(cellKey, true);
              successCount++;
            } else {
              console.warn('[_renderCells] Neither add nor setMap is available');
              failCount++;
            }
          } catch (error) {
            console.error('Error adding rectangle to map:', error, {
              row,
              col,
              cellKey,
              hasAmap: !!this.amap,
              hasAdd: !!(this.amap && this.amap.add),
              hasSetMap: !!(rectangle && rectangle.setMap),
              rectangleType: rectangle?.constructor?.name
            });
            failCount++;
          }
        } else {
          console.warn('[_renderCells] Map instance or rectangle is invalid', {
            row,
            col,
            hasAmap: !!this.amap,
            hasRectangle: !!rectangle,
            isValidMap: this.isValidMapInstance()
          });
          failCount++;
        }
      }
    });

    // 检查是否有缺失的单元格
    const expectedCells = rows! * cols!;
    if (successCount < expectedCells) {
      console.warn(
        `[_renderCells] Missing cells: expected ${expectedCells}, rendered ${successCount}, failed ${failCount} (${((successCount / expectedCells) * 100).toFixed(1)}%)`
      );
    }

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
  config?: Partial<TemperatureGridConfig>,
  options?: TemperatureGridRenderOptions
): Promise<TemperatureGridRenderer> {
  const renderer = new TemperatureGridRenderer(amap, config);
  await renderer.renderTemperatureGrid(bounds, options);
  return renderer;
}
