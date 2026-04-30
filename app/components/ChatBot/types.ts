export type ChatLayoutMode = 'closed' | 'floating' | 'docked' | 'fullscreen-mobile';

export const WEATHER_ASSISTANT_SCHEMA_VERSION = 'weather.assistant.v1' as const;

export type WeatherAssistantSchemaVersion = typeof WEATHER_ASSISTANT_SCHEMA_VERSION;

export interface WeatherPanelBase {
  schemaVersion: WeatherAssistantSchemaVersion;
  id: string;
}

export interface CurrentForecastPanel extends WeatherPanelBase {
  kind: 'current_forecast';
  title: string;
  requestedDays: number;
  location: {
    name: string;
    region?: string;
    country?: string;
    lat?: number;
    lon?: number;
    localtime?: string;
  };
  current: {
    tempC: number;
    feelsLikeC: number;
    condition: string;
    icon?: string;
    humidity: number;
    windKph: number;
    windDir: string;
    pressureMb: number;
    visibilityKm: number;
    uv: number;
    cloud: number;
    precipMm: number;
    lastUpdated?: string;
  };
  daily: Array<{
    date: string;
    condition: string;
    icon?: string;
    minTempC: number;
    maxTempC: number;
    rainChance: number;
    humidity: number;
    uv: number;
  }>;
  hourly: Array<{
    time: string;
    tempC: number;
    condition: string;
    icon?: string;
    rainChance: number;
  }>;
}

export interface Forecast30dPanel extends WeatherPanelBase {
  kind: 'forecast_30d';
  title: string;
  requestedDays: number;
  location: {
    longitude: number;
    latitude: number;
    name?: string;
    region?: string;
    country?: string;
  };
  updateTime?: string;
  daily: Array<{
    date: string;
    textDay: string;
    textNight: string;
    tempMinC: number;
    tempMaxC: number;
    humidity: number;
    precipMm: number;
    windDirDay: string;
    windScaleDay: string;
    uvIndex: number;
  }>;
}

export interface CitySearchPanel extends WeatherPanelBase {
  kind: 'city_search';
  title: string;
  query: string;
  results: Array<{
    chineseName: string;
    englishName: string;
  }>;
}

export interface ConditionSearchPanel extends WeatherPanelBase {
  kind: 'condition_search';
  title: string;
  condition:
    | 'snow'
    | 'rain'
    | 'hot'
    | 'cold'
    | 'wind'
    | 'clear'
    | 'cloudy'
    | 'overcast'
    | 'fog'
    | 'haze'
    | 'thunder'
    | 'humid'
    | 'dry'
    | 'comfortable'
    | 'adverse';
  scope: 'china' | 'province';
  province?: string;
  checkedCount: number;
  failedCount: number;
  updatedAt?: string;
  confidenceNote: string;
  matchedLocations: Array<{
    name: string;
    province?: string;
    temperatureC?: number;
    conditionText: string;
    precipMm?: number;
    windKph?: number;
    updatedAt?: string;
  }>;
}

export interface WeatherErrorPanel extends WeatherPanelBase {
  kind: 'error';
  title: string;
  message: string;
  toolName?: string;
}

export type WeatherAssistantPanel =
  | CurrentForecastPanel
  | Forecast30dPanel
  | ConditionSearchPanel
  | CitySearchPanel
  | WeatherErrorPanel;

export type ChatSSEEvent =
  | { type: 'text'; content: string }
  | { type: 'panel'; panel: WeatherAssistantPanel }
  | { type: 'agent_plan'; content: string }
  | { type: 'agent_step'; title: string; toolName?: string; status: 'running' | 'done' }
  | { type: 'agent_observation'; content: string }
  | { type: 'tool_start'; name: string; args?: Record<string, unknown> }
  | { type: 'tool_end'; name: string }
  | { type: 'error'; content: string; panel?: WeatherErrorPanel }
  | { type: 'done' };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  panels?: WeatherAssistantPanel[];
  toolName?: string;
  toolStatus?: 'calling' | 'done';
}
