import type { WeatherAssistantPanel } from '@/app/lib/contracts/weatherAssistant';

export type ChatLayoutMode = 'closed' | 'floating' | 'docked' | 'fullscreen-mobile';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  panels?: WeatherAssistantPanel[];
  toolName?: string;
  toolStatus?: 'calling' | 'done';
}
