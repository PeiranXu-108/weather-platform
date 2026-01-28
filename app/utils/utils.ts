  // Generate gradient color based on temperature with deep purple for lower temps
  export const getTemperatureColor = (temp: number): string => {
    const minTemp = -15;
    const maxTemp = 40;
    const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

    const colorStops = [
      { t: 0.0, r: 55, g: 0, b: 120 },      
      { t: 0.12, r: 59, g: 130, b: 246 },  
      { t: 0.2, r: 6, g: 182, b: 212 },
      { t: 0.4, r: 16, g: 185, b: 129 },
      { t: 0.6, r: 234, g: 179, b: 8 },
      { t: 0.8, r: 249, g: 115, b: 22 },
      { t: 1.0, r: 239, g: 68, b: 68 }
    ];

    for (let i = 0; i < colorStops.length - 1; i++) {
      if (normalized >= colorStops[i].t && normalized <= colorStops[i + 1].t) {
        const t = (normalized - colorStops[i].t) / (colorStops[i + 1].t - colorStops[i].t);
        const r = Math.round(colorStops[i].r + t * (colorStops[i + 1].r - colorStops[i].r));
        const g = Math.round(colorStops[i].g + t * (colorStops[i + 1].g - colorStops[i].g));
        const b = Math.round(colorStops[i].b + t * (colorStops[i + 1].b - colorStops[i].b));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    return `rgb(55, 0, 120)`;
  };