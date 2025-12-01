# Weather Dashboard - Hangzhou

A modern, real-time weather visualization dashboard built with Next.js, TypeScript, Tailwind CSS, and ECharts.

## Features

- 🌤️ **Current Weather Display** - Real-time weather conditions with temperature, humidity, wind speed, and more
- 📊 **3-Day Temperature Forecast** - Interactive line chart showing max, min, and average temperatures
- ⏰ **24-Hour Forecast** - Detailed hourly temperature predictions with data zoom capability
- 📈 **Weather Metrics** - Comprehensive cards displaying humidity, wind, pressure, UV index, visibility, and precipitation
- 🎨 **Modern UI** - Responsive design with Tailwind CSS, supports light and dark modes
- 🔄 **Auto-refresh** - Automatically updates weather data every 30 minutes

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: ECharts & echarts-for-react
- **API**: WeatherAPI.com

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository or navigate to the project directory:

```bash
cd /Users/xupeiran/Desktop/毕业设计/weather-demo
```

2. Install dependencies (already done):

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
weather-demo/
├── app/
│   ├── api/
│   │   └── weather/
│   │       └── route.ts          # API route for fetching weather data
│   ├── components/
│   │   ├── CurrentWeather.tsx    # Current weather display
│   │   ├── TemperatureChart.tsx  # 3-day temperature chart (ECharts)
│   │   ├── HourlyChart.tsx       # 24-hour forecast chart (ECharts)
│   │   └── WeatherMetrics.tsx    # Weather metrics cards
│   ├── types/
│   │   └── weather.ts            # TypeScript type definitions
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main dashboard page
├── public/                       # Static assets
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── next.config.mjs               # Next.js configuration
└── package.json                  # Project dependencies
```

## Components

### CurrentWeather
Displays the current weather conditions including:
- Location name and time
- Current temperature with weather icon
- Feels like temperature
- Humidity, wind speed, and UV index

### TemperatureChart
Interactive ECharts visualization showing:
- 3-day temperature forecast
- Max, min, and average temperature lines
- Smooth curves with hover tooltips

### HourlyChart
24-hour forecast chart featuring:
- Temperature and "feels like" temperature
- Data zoom for better navigation
- Area gradient fill under the line

### WeatherMetrics
Grid of metric cards displaying:
- Humidity percentage
- Wind speed and direction
- Atmospheric pressure
- UV index
- Visibility distance
- Precipitation amount

## API

The application uses WeatherAPI.com to fetch weather data for Hangzhou. The API route (`/api/weather`) handles:
- Fetching 3-day forecast data
- Caching responses for 30 minutes
- Error handling

## Responsive Design

The dashboard is fully responsive with breakpoints for:
- Mobile devices (< 768px)
- Tablets (768px - 1024px)
- Desktop (> 1024px)

## Dark Mode

Supports automatic dark mode based on system preferences using Tailwind CSS dark mode classes.

## Build for Production

```bash
npm run build
npm start
```

## License

This project is for educational purposes.

## Credits

- Weather data: [WeatherAPI.com](https://www.weatherapi.com/)
- Charts: [Apache ECharts](https://echarts.apache.org/)
- Framework: [Next.js](https://nextjs.org/)

