import type { ChatSSEEvent } from '@/app/lib/contracts/weatherAssistant';
import type { WeatherConditionIntent } from './weatherConditions';

export type AgentTaskType =
  | 'single_location_weather'
  | 'area_condition_search'
  | 'comparison'
  | 'advice'
  | 'smalltalk';

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
