import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from '@wuba/react-native-echarts';

let registered = false;

export function ensureEchartsSetup() {
  if (registered) return echarts;
  echarts.use([SVGRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent]);
  registered = true;
  return echarts;
}
