import type { ChatSSEEvent } from '@/app/components/ChatBot/types';

export type AgentTaskType =
  | 'single_location_weather'
  | 'area_condition_search'
  | 'comparison'
  | 'advice'
  | 'smalltalk';

export type WeatherConditionIntent =
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

export interface AgentPlan {
  taskType: AgentTaskType;
  summary: string;
  steps: AgentStep[];
}

export interface AgentStep {
  id: string;
  title: string;
  toolName?: string;
}

export interface AgentObservation {
  stepId: string;
  summary: string;
}

export type AgentEmit = (event: ChatSSEEvent) => void;

export interface AreaConditionIntent {
  taskType: 'area_condition_search';
  condition: WeatherConditionIntent;
  scope: 'china' | 'province';
  province?: string;
  phrase: string;
}
