# 天气可视化平台（Weather Platform）

基于 **Next.js 14（App Router）+ TypeScript + Tailwind CSS** 构建的天气可视化应用，集成：

- 国内地图（高德）2D / 3D 模式
- Three.js 地球交互（点击地球任意点查询天气）
- 多图层可视化（温度网格 / 风场 / 云图 / 降水）+ 时间轴回放
- 收藏城市（游客本地存储 / 登录后 MongoDB 同步）
- AI 天气助手（Qwen + MCP 工具编排，SSE 流式输出）

## 功能概览

- **定位与搜索**：支持浏览器定位（Geolocation API）、城市搜索、经纬度查询。
- **实时天气与预报**：当前天气、24 小时曲线/卡片、30 天预报（按经纬度）。
- **可视化地图**：
  - **2D 高德地图**：拖拽/缩放，中心点天气卡片。
  - **3D 地球**：旋转/缩放，点击地球拾取经纬度并查询天气。
  - **图层**：温度（网格渲染）、风场（粒子/矢量）、云图、降水（强度/分布）。
  - **时间轴**：按步进回放（用于各图层的时序渲染与对比）。
- **用户系统**：邮箱+密码（NextAuth Credentials），收藏夹在登录后持久化到 MongoDB。
- **AI 天气助手**：调用 Qwen（OpenAI 兼容）并通过 MCP 工具获取天气数据，SSE 实时返回。

## 技术栈

- **框架**：Next.js 14（App Router）
- **语言**：TypeScript / React 18
- **样式**：Tailwind CSS
- **图表**：Apache ECharts（`echarts` + `echarts-for-react`）
- **3D 可视化**：Three.js（`three` + `@react-three/fiber` + `@react-three/drei`）
- **鉴权**：NextAuth（Credentials）
- **数据库**：MongoDB（Mongoose）
- **大模型**：Qwen（DashScope OpenAI-Compatible）+ MCP 工具编排

## 快速开始

### 环境要求

- Node.js 18+
- npm（或 yarn/pnpm，自行替换命令）

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env.local`（不要提交到仓库），至少需要：

| 变量名 | 用途 | 是否必需 |
| --- | --- | --- |
| `API_KEY` | WeatherAPI Key（用于 `/api/weather`，3 天预报 + 实况） | 是 |
| `API_BASE_URL` | WeatherAPI 基地址（如 forecast.json 的完整 URL） | 是 |
| `QWEATHER_API_KEY` | 和风天气 Key（用于 `/api/weather/30d`） | 是（如使用 30 天预报） |
| `QWEATHER_API_BASE` | 和风 30 天预报接口地址 | 是（如使用 30 天预报） |
| `NEXT_PUBLIC_AMAP_KEY` | 高德 JS API Key（前端加载地图 SDK） | 是（如使用地图） |
| `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE` | 高德安全密钥（SecurityJsCode） | 取决于你的高德配置 |
| `DASHSCOPE_API_KEY` | DashScope Key（Qwen：`/api/chat`、`/api/translate`） | 是（如使用 AI） |
| `MONGODB_URI` | MongoDB 连接串（收藏夹/使用量等数据） | 登录相关功能需要 |
| `NEXTAUTH_SECRET` | NextAuth secret（JWT/会话签名） | 登录相关功能需要 |

### 启动开发环境

```bash
npm run dev
```

打开 `http://localhost:3000`。

### 生产构建

```bash
npm run build
npm run start
```

## 主要目录结构

```text
weather-platform/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth Route Handler
│   │   ├── chat/route.ts                 # AI 天气助手（SSE + MCP tools）
│   │   ├── translate/route.ts            # Qwen 翻译（地名/天气描述）
│   │   ├── weather/route.ts              # WeatherAPI：实况 + 3 天预报（支持 city / lat+lon）
│   │   ├── weather/30d/route.ts          # 和风：30 天预报（按经纬度）
│   │   ├── favorites/route.ts            # 收藏夹（登录用户）
│   │   ├── favorites/sync/route.ts       # 收藏夹本地→云端合并
│   │   └── usage/route.ts                # 近 30 天 API 使用量（登录用户）
│   ├── components/
│   │   ├── Map/                          # 地图与图层渲染（2D/3D/时间轴/图例）
│   │   ├── ChatBot/                      # AI 天气助手前端
│   │   └── ...                           # 主页卡片、图表、收藏抽屉、设置等
│   ├── lib/
│   │   ├── api.ts                        # 前端 API 封装
│   │   ├── auth.ts                       # NextAuth 配置（Credentials）
│   │   ├── mongodb.ts                    # MongoDB 连接
│   │   └── models/                       # Mongoose Models
│   ├── utils/                            # 各类渲染器与翻译/搜索工具
│   └── page.tsx                          # 主页面（定位/搜索/图表/地图/AI）
├── public/
│   └── icons/                            # 图标资源（SVG）
└── package.json
```

## 使用说明与注意事项

- **地图显示**：地图模块依赖高德 JS SDK（需要正确配置 `NEXT_PUBLIC_AMAP_KEY` 等）。当前页面仅在判定为国内/港澳台地点时展示地图模块（见主页逻辑）。
- **游客 vs 登录**：
  - 未登录：收藏保存在 `localStorage`。
  - 已登录：收藏保存在 MongoDB，并在登录后触发本地收藏与云端收藏的合并同步。
- **AI 天气助手**：
  - 后端走 `/api/chat`（SSE 流式返回）。
  - 会编排 MCP 工具获取天气信息，再由 Qwen 组织自然语言回复。

## License

仅用于学习与演示。

## Credits

- Weather data: [WeatherAPI.com](https://www.weatherapi.com/)
- 30-day forecast: [和风天气](https://www.qweather.com/)
- Maps: [高德开放平台](https://lbs.amap.com/)
- Charts: [Apache ECharts](https://echarts.apache.org/)
- Framework: [Next.js](https://nextjs.org/)
