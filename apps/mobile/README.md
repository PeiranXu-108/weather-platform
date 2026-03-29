# Weather Mobile (Expo Managed)

## Quick Start

1. Copy env:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run app:

```bash
npm run start
```

## Architecture

- `app/`: expo-router screens
- `src/features/weather`: current weather, hourly strip, metrics
- `src/features/charts`: hourly and 30-day charts (RN ECharts + Skia renderer)
- `src/features/map`: map and Skia weather overlays
- `src/data`: API repositories and cache/auth helpers
- `src/state`: zustand stores

## Backend Integration

Mobile app consumes existing Next.js BFF endpoints:

- `/api/weather`
- `/api/weather/30d`
- `/api/favorites`
- `/api/favorites/sync`
- `/api/usage`
- `/api/chat`
- `/api/mobile/auth`
- `/api/mobile/me`

## Verification Checklist

- Home page loads weather by city and location
- 24h + 30d charts render correctly
- Map overlays animate with timeline
- Auth login/register issues mobile token
- Favorites and usage work under bearer token auth

