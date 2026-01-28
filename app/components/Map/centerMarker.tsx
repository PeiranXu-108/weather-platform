import type { Current } from '@/app/types/weather';
import { getTemperatureColor } from '@/app/utils/utils';

export const centerMarkerSize = 60;
const defaultCenterMarkerBorder = '#9be16a';

export const formatCenterTemp = (current?: Current | null) => {
  if (!current || typeof current.temp_c !== 'number' || Number.isNaN(current.temp_c)) {
    return '--';
  }
  return `${Math.round(current.temp_c)}`;
};

export const formatMinMaxTemp = (temp?: number) => {
  if (typeof temp !== 'number' || Number.isNaN(temp)) {
    return '--';
  }
  return `${Math.round(temp)}`;
};

export const getCenterMarkerBorderColor = (current?: Current | null) => {
  if (!current || typeof current.temp_c !== 'number' || Number.isNaN(current.temp_c)) {
    return defaultCenterMarkerBorder;
  }
  return getTemperatureColor(current.temp_c);
};

// Calculate position on arc (0 to 1) based on current temp relative to min/max
const calculateArcPosition = (current: number, min: number, max: number): number => {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (current - min) / (max - min)));
};

// Get gradient color for arc segment
const getGradientColor = (ratio: number, minTemp: number, maxTemp: number): string => {
  const temp = minTemp + (maxTemp - minTemp) * ratio;
  return getTemperatureColor(temp);
};

export const buildCenterMarkerContent = (
  currentTemp: number | null,
  minTemp: number | null,
  maxTemp: number | null,
  tempText: string
) => {
  const hasValidData = currentTemp !== null && minTemp !== null && maxTemp !== null;
  const arcPosition = hasValidData ? calculateArcPosition(currentTemp, minTemp, maxTemp) : 0.5;
  
  // Create unique gradient ID to avoid conflicts
  const gradientId = `tempGradient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create SVG arc for gradient temperature range
  // Arc positioned above the circle, covering the top half (9 o'clock to 3 o'clock)
  // Arc represents temperature range from min (left) to max (right)
  const strokeWidth = 6;
  const circleCenter = centerMarkerSize / 2;
  
  // Arc positioning: cover top half of circle
  // Arc center is same as circle center
  const arcCenterX = circleCenter;
  const arcCenterY = circleCenter;
  const arcRadius = circleCenter - 2; // Slightly smaller than circle radius to sit on top
  
  // Arc goes from 9 o'clock (left, min temp) to 3 o'clock (right, max temp)
  // Covering the TOP half of the circle, going COUNTER-CLOCKWISE through 12 o'clock
  // In SVG coordinates: 0° = 3 o'clock (right), angles increase clockwise
  // 9 o'clock = 180° = π radians (left, min temp)
  // 3 o'clock = 0° = 0 radians (right, max temp)
  // 12 o'clock = 270° = 3π/2 radians (top)
  // To cover top half: go COUNTER-CLOCKWISE from 9 o'clock to 3 o'clock (180° → 270° → 0°)
  const startAngle = Math.PI; // 9 o'clock (180°, left side, min temp)
  const endAngle = 0; // 3 o'clock (0°, right side, max temp)
  
  // Create gradient stops for the arc
  // Path goes from 9 o'clock (left, min temp) to 3 o'clock (right, max temp) counter-clockwise
  // So offset 0% = 9 o'clock (min temp), offset 100% = 3 o'clock (max temp)
  // This matches visual: min (left) to max (right)
  const gradientStops = hasValidData ? Array.from({ length: 8 }, (_, i) => {
    const ratio = i / 7;
    // ratio 0 → min temp (left), ratio 1 → max temp (right)
    const temp = minTemp! + (maxTemp! - minTemp!) * ratio;
    const color = getTemperatureColor(temp);
    return `<stop offset="${ratio * 100}%" stop-color="${color}" />`;
  }).join('') : `<stop offset="0%" stop-color="#9be16a" /><stop offset="100%" stop-color="#9be16a" />`;
  
  // Calculate dot position on arc (current temperature position)
  // Interpolate angle from start (9 o'clock) to end (3 o'clock) going COUNTER-CLOCKWISE
  // Using LARGE arc: Counter-clockwise from 180° to 0°: 180° → 270° → 360° → 0° (through 12 o'clock at top)
  // arcPosition: 0 = min temp (left/9 o'clock), 1 = max temp (right/3 o'clock)
  // Large arc path length: 270° = 3π/2 radians
  // When arcPosition=0 (min): angle = 180° (9 o'clock) ✓
  // When arcPosition=1 (max): angle = 0° (3 o'clock) ✓
  // Formula: startAngle - arcPosition * largeArcLength
  const largeArcLength = 2 * Math.PI - (startAngle - endAngle); // 2π - π = π, but we need 3π/2
  // Actually, large arc from 180° to 0° counter-clockwise is 270° = 3π/2
  const actualArcLength = (3 * Math.PI) / 2; // 270° for large arc
  let dotAngle = startAngle - arcPosition * actualArcLength;
  // Normalize angle to [0, 2π)
  if (dotAngle < 0) dotAngle += 2 * Math.PI;
  const dotX = arcCenterX + arcRadius * Math.cos(dotAngle);
  const dotY = arcCenterY + arcRadius * Math.sin(dotAngle);
  
  const minText = hasValidData ? formatMinMaxTemp(minTemp) : '--';
  const maxText = hasValidData ? formatMinMaxTemp(maxTemp) : '--';
  
  return `
    <div style="
      position: relative;
      width: ${centerMarkerSize}px;
      height: ${centerMarkerSize + 15}px;
    ">
      <!-- Speech bubble circle -->
      <div style="
        position: absolute;
        width: ${centerMarkerSize}px;
        height: ${centerMarkerSize}px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #e0f2fe;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 2;
        overflow: visible;
      ">
        <!-- Current temperature (main) -->
        <div style="
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1;
          margin-top: 2px;
          z-index: 3;
          position: relative;
        ">${tempText}°</div>
        
        <!-- Min/Max temperatures -->
        <div style="
          display: flex;
          justify-content: space-between;
          width: 100%;
          padding: 0 10px;
          margin-top: 1px;
          font-size: 10px;
          font-weight: 400;
          z-index: 3;
          position: relative;
        ">
          <span style="color: #2563eb;">${minText}</span>
          <span style="color: #60a5fa;">${maxText}</span>
        </div>
      </div>
      
      <!-- SVG for gradient arc (positioned above the circle, covering top half) -->
      <!-- z-index: 3 ensures arc is visible above the white circle -->
      <svg width="${centerMarkerSize}" height="${centerMarkerSize}" style="position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible; z-index: 3;">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops}
          </linearGradient>
        </defs>
        <!-- Arc curves over TOP half of circle from left (min temp) to right (max temp) -->
        <!-- Arc goes COUNTER-CLOCKWISE from 9 o'clock (180°) to 3 o'clock (0°) through 12 o'clock -->
        <!-- large-arc-flag=1 (large arc, 270°), sweep-flag=0 (counter-clockwise) -->
        <!-- Large arc needed to go through top (12 o'clock) instead of bottom (6 o'clock) -->
        <path
          d="M ${arcCenterX + arcRadius * Math.cos(startAngle)} ${arcCenterY + arcRadius * Math.sin(startAngle)} A ${arcRadius} ${arcRadius} 0 1 0 ${arcCenterX + arcRadius * Math.cos(endAngle)} ${arcCenterY + arcRadius * Math.sin(endAngle)}"
          fill="none"
          stroke="url(#${gradientId})"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
        />
        <!-- Current temp indicator dot on arc (pointer) -->
        ${hasValidData ? `
          <circle
            cx="${dotX}"
            cy="${dotY}"
            r="2.5"
            fill="#60a5fa"
            stroke="#ffffff"
            stroke-width="1.5"
          />
        ` : ''}
      </svg>
      
      <!-- Speech bubble pointer -->
      <div style="
        position: absolute;
        top: ${centerMarkerSize - 4}px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #ffffff;
        z-index: 1;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      "></div>
      
      <!-- Map point indicator -->
      <div style="
        position: absolute;
        top: ${centerMarkerSize + 16}px;
        left: 50%;
        transform: translateX(-50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        z-index: 0;
      "></div>
    </div>
  `;
};
