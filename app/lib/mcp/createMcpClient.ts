/**
 * MCP Client 工厂函数
 * 
 * 使用 InMemoryTransport 在同进程内连接 MCP Server 和 Client，
 * 无需启动额外进程或 HTTP 服务。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWeatherServer } from './weatherServer';

/**
 * 创建一个已连接到 MCP Weather Server 的 Client
 * 
 * 使用 InMemoryTransport 实现进程内通信，适合 serverless 环境。
 * 每次请求创建新的 client-server 对，保证无状态。
 */
export async function createMcpClient(): Promise<Client> {
  const server = createWeatherServer();

  // 创建内存传输层的成对链接
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // 连接 server 和 client
  await server.connect(serverTransport);

  const client = new Client({
    name: 'weather-chat-client',
    version: '1.0.0',
  });

  await client.connect(clientTransport);

  return client;
}

/**
 * 将 MCP 工具列表转换为 OpenAI function calling 格式
 * 
 * MCP tools 使用 JSON Schema 定义输入，
 * OpenAI 使用 { type: "function", function: { name, description, parameters } } 格式。
 */
export function mcpToolsToOpenAITools(
  mcpTools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>
) {
  return mcpTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema,
    },
  }));
}
