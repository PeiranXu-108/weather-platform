'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'zh' | 'en';

const LOCALE_STORAGE_KEY = 'wp:locale:v1';

type TranslationParams = Record<string, string | number>;

const translations = {
  zh: {
    'common.loading': '加载中',
    'common.close': '关闭',
    'common.confirm': '确定',
    'common.expand': '展开',
    'common.select': '选择',
    'common.search': '搜索',
    'common.current': '当前',
    'common.now': '现在',
    'common.update': '更新',
    'common.updatedAt': '更新 {time}',
    'common.times': '{count} 次',
    'common.daysCount': '{count}天',
    'common.degreeDays': '{count}天',

    'settings.open': '打开设置',
    'settings.title': '设置',
    'settings.opacity': '透明度',
    'settings.backgroundRendering': '背景渲染',
    'settings.disableBackgroundRendering': '禁用背景渲染',
    'settings.enableBackgroundRendering': '启用背景渲染',
    'settings.wallpaperCapturing': '截取中…',
    'settings.wallpaperCopied': '已复制到剪贴板',
    'settings.wallpaperFailed': '截取失败',
    'settings.captureWallpaper': '截取壁纸',
    'settings.fireworksRunningTitle': '烟花绽放中…',
    'settings.fireworksTitle': '点击燃放一场约 7 秒的烟花',
    'settings.launchFireworks': '燃放烟花',
    'settings.fireworksRunning': '绽放中…',
    'settings.watchFireworks': '看烟花',
    'settings.language': '语言',
    'settings.languageChinese': '中文',
    'settings.languageEnglish': 'English',

    'header.profileCenter': '个人中心',
    'header.login': '登录',
    'header.searchCity': '搜索城市',
    'header.getCurrentLocation': '获取当前位置',
    'header.locating': '定位中',
    'header.geolocationUnsupported': '您的浏览器不支持地理位置功能',
    'header.locationFailedPrefix': '获取位置失败：',
    'header.locationDenied': '用户拒绝了地理位置请求',
    'header.locationUnavailable': '位置信息不可用',
    'header.locationTimeout': '获取位置超时',
    'header.locationUnknown': '未知错误',

    'auth.welcomeBack': '欢迎回来',
    'auth.registerAccount': '注册账号',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.login': '登录',
    'auth.register': '注册',
    'auth.noAccount': '还没有账号？',
    'auth.haveAccount': '已有账号？',
    'auth.goRegister': '去注册',
    'auth.goLogin': '去登录',
    'auth.genericError': '发生错误，请稍后再试',
    'profile.totalApiUsage': 'API 总用量：',
    'profile.last30DaysUsage': '过去 30 天 API 用量',
    'profile.apiCalls': 'API 调用：{count} 次',
    'profile.countAxis': '次数',
    'profile.apiUsage': 'API 用量',
    'profile.signOut': '退出登录',

    'weather.favoriteRemoveAria': '取消收藏城市',
    'weather.favoriteAddAria': '收藏该城市',
    'weather.favoriteRemoveTitle': '已收藏，点击取消',
    'weather.favoriteAddTitle': '点击收藏',
    'weather.favorited': '已收藏',
    'weather.favorite': '收藏',
    'weather.lastUpdatedBeijing': '最后更新：北京时间 {time}',
    'weather.localTime': '当地时间 {time}',
    'weather.metricsTitle': '天气指标',
    'weather.humidity': '湿度',
    'weather.windSpeed': '风速',
    'weather.pressure': '气压',
    'weather.uv': '紫外线',
    'weather.visibility': '能见度',
    'weather.precipitation': '降水量',
    'weather.windDirection': '风向',
    'weather.cloudAmount': '云量',
    'weather.temperature': '温度',
    'weather.uvIndex': '紫外线指数',
    'weather.gust': '阵风',
    'weather.dewPoint': '露点',
    'weather.hourlyForecastTitle': '24小时{label}预报',
    'weather.next24Hours': '未来24小时',
    'weather.viewHourDetails': '查看{time}天气详情',
    'weather.feelsLike': '体感 {value}',
    'weather.sunrise': '日出',
    'weather.sunset': '日落',
    'weather.closeDetails': '关闭天气详情',
    'weather.dayPeriod': '白天时段',
    'weather.nightPeriod': '夜间时段',
    'weather.rainChance': '降水概率 {value}%',
    'weather.rainProbability': '雨概率 {rain}% · 雪概率 {snow}%',
    'weather.relativeHumidity': '空气相对湿度',
    'weather.cloudCoverage': '天空云覆盖率',
    'weather.windGust': '风速 / 阵风',
    'weather.gustValue': '阵风 {value}',
    'weather.seaLevelPressure': '海平面气压',
    'weather.dewPointSub': '空气水汽饱和温度',
    'weather.visibilitySub': '水平能见距离',
    'weather.uvIndexSub': 'UV 指数',
    'weather.precipSnow': '降水/降雪',
    'weather.dayWindGust': '风速 / 阵风（白天）',
    'weather.nightWindGust': '风速 / 阵风（夜间）',
    'weather.dayWindDirection': '风向（白天）',
    'weather.dailyPrecip': '日降水量',
    'weather.forecast30Title': '30日天气预报',
    'weather.weatherDistribution30': '30日天气分布',
    'weather.weatherDistribution': '天气分布',
    'weather.daysSuffix': '{value}天',
    'weather.maxTemp': '最高',
    'weather.minTemp': '最低',
    'weather.avgTemp': '平均温度',
    'weather.tempRange': '温度范围',
    'weather.tempDiff': '温差',
    'weather.maxTemperature': '最高温度',
    'weather.minTemperature': '最低温度',
    'weather.cooling': '降温',
    'weather.precipShort': '降水',
    'weather.calendar': '日历',
    'weather.chart': '图表',
    'weather.barChart': '柱状图',
    'weather.lineChart': '折线图',
    'weather.scatterChart': '散点图',
    'weather.pieChart': '饼状图',
    'weather.loadFailed': '加载失败: {error}',
    'weather.dataSourceFooter': '数据来源：WeatherAPI.com • 最后更新：{time}',
    'weather.errorModalMessage': '加载天气数据失败：{error}\n\n请稍后重试。',

    'favorites.viewWeather': '查看{name}天气',
    'favorites.loading': '加载中…',
    'favorites.notLoaded': '未加载',
    'favorites.updating': '正在更新…',
    'favorites.pendingUpdate': '待更新',
    'favorites.openDrawer': '打开收藏城市抽屉',
    'favorites.title': '收藏城市',
    'favorites.drawerTitle': '收藏抽屉',
    'favorites.collapseDrawer': '收起收藏抽屉',
    'favorites.collapse': '收起',
    'favorites.empty': '暂无收藏城市',

    'map.title': '地图位置',
    'map.mapView': '地图视图',
    'map.globeView': '地球视图',
    'map.layersOn': '图层：已开启',
    'map.layerOptions': '图层选项',
    'map.temperatureLayer': '气温',
    'map.windLayer': '风力',
    'map.cloudLayer': '云量',
    'map.precipLayer': '降水',
    'map.exitFullscreen': '退出全屏',
    'map.fullscreen': '全屏',
    'map.zoomOut': '缩小',
    'map.zoomIn': '放大',
    'map.coordinates': '坐标: {lat}, {lon}',
    'map.temperatureLegend': '气温（℃）',
    'map.precipLegend': '降水量 (mm)',
    'map.currentLocation': '当前位置',
    'map.viewLocationWeather': '查看该地点天气',
    'map.play': '播放动画',
    'map.pause': '暂停播放',
    'map.timelineAria': '未来48小时天气时间轴',
    'map.timelineOffset': 'T+{hours}小时 · {time}',
    'map.next48Hours': '未来48小时',

    'chat.openAssistant': '打开天气助手',
    'chat.closeAssistant': '关闭天气助手',
    'chat.title': '天气小助手',
    'chat.welcomeTitle': '你好，我是天气小助手',
    'chat.welcomeDescription': '可以帮你查询全球城市的天气信息',
    'chat.tryAsk': '试试问我',
    'chat.inputPlaceholder': '输入你的天气问题...',
    'chat.send': '发送',
    'chat.expandWindow': '放大聊天窗口',
    'chat.restoreWindow': '还原聊天窗口',
    'chat.requestFailed': '请求失败',
    'chat.streamReadFailed': '无法读取响应流',
    'chat.genericAssistantError': '抱歉，出现了错误，请稍后再试。',
    'chat.requestProblem': '抱歉，请求出现了问题：{error}。请稍后再试。',
    'chat.unknownError': '未知错误',
    'chat.quick.localWeather': '我这的天气怎么样？',
    'chat.quick.snowChina': '中国哪里在下雪？',
    'chat.quick.rainZhejiang': '浙江哪里在下雨？',
    'chat.quick.beijingRainTomorrow': '北京明天会下雨吗？',
    'chat.quick.shanghaiWeek': '上海未来一周天气预报',
    'chat.quick.hangzhouToday': '杭州今天天气怎么样？',
    'chat.quick.shenzhenRain3d': '深圳未来3天会下雨吗？',
    'chat.quick.chengduUv': '成都的紫外线强不强？',
    'chat.quick.guangzhouHumidity': '广州现在湿度多少？',
    'chat.quick.nanjingOutdoor': '南京明天适合户外活动吗？',
    'chat.quick.wuhanWeekend': '武汉周末天气如何？',
    'chat.quick.xianCooling': '西安最近会降温吗？',
    'chat.quick.suzhouAir': '苏州空气质量怎么样？',
    'chat.quick.xiamenWind': '厦门海边风大吗？',
    'chat.quick.qingdaoTravel': '青岛适合去玩吗？',
    'chat.quick.shanghaiToday': '今天上海的天气怎么样？',
    'chat.panel.unknownLocation': '未知位置',
    'chat.panel.feelsLike': '体感',
    'chat.panel.wind': '风',
    'chat.panel.precipUv': '降水 / UV',
    'chat.panel.nextDays': '未来{days}天',
    'chat.panel.rainHumidityUv': '降雨概率 {rain}% · 湿度 {humidity}% · UV {uv}',
    'chat.panel.precipHumidityWindUv': '降水 {precip} mm · 湿度 {humidity}% · {windDir}{windScale}级 · UV {uv}',
    'chat.panel.queryMatches': '“{query}” 的匹配城市',
    'chat.panel.noCityMatches': '没有找到匹配城市，可以试试更完整的城市名。',
    'chat.panel.mainCities': '全国主要城市',
    'chat.panel.checkedCities': '已检查 {checked} 个城市{failed}{updated}',
    'chat.panel.failedCities': '，{count} 个失败',
    'chat.panel.noConditionMatches': '暂未在已检查城市中发现匹配地点。',
    'chat.panel.precipValue': '降水 {value} mm',
    'chat.panel.windSpeedValue': '风速 {value} km/h',
    'chat.panel.tool': '工具：{name}',
    'chat.tool.currentWeather': '实时天气',
    'chat.tool.forecast30d': '30天预报',
    'chat.tool.locationWeather': '当前位置天气',
    'chat.tool.citySearch': '城市搜索',
    'chat.tool.candidateCities': '候选城市',
    'chat.tool.batchWeather': '批量天气',
    'chat.tool.conditionSearch': '区域天气检索',
    'chat.tool.agentPlan': 'Agent 计划',
    'chat.tool.agentStep': 'Agent 步骤',
    'chat.tool.agentObservation': 'Agent 观察',
    'chat.tool.calling': '正在查询{name}...',
    'chat.tool.done': '{name}查询完成',
  },
  en: {
    'common.loading': 'Loading',
    'common.close': 'Close',
    'common.confirm': 'OK',
    'common.expand': 'Expand',
    'common.select': 'Select',
    'common.search': 'Search',
    'common.current': 'Current',
    'common.now': 'Now',
    'common.update': 'Updated',
    'common.updatedAt': 'Updated {time}',
    'common.times': '{count} times',
    'common.daysCount': '{count} days',
    'common.degreeDays': '{count} days',

    'settings.open': 'Open settings',
    'settings.title': 'Settings',
    'settings.opacity': 'Opacity',
    'settings.backgroundRendering': 'Background rendering',
    'settings.disableBackgroundRendering': 'Disable background rendering',
    'settings.enableBackgroundRendering': 'Enable background rendering',
    'settings.wallpaperCapturing': 'Capturing...',
    'settings.wallpaperCopied': 'Copied to clipboard',
    'settings.wallpaperFailed': 'Capture failed',
    'settings.captureWallpaper': 'Capture wallpaper',
    'settings.fireworksRunningTitle': 'Fireworks in progress...',
    'settings.fireworksTitle': 'Launch about 7 seconds of fireworks',
    'settings.launchFireworks': 'Launch fireworks',
    'settings.fireworksRunning': 'Launching...',
    'settings.watchFireworks': 'Watch fireworks',
    'settings.language': 'Language',
    'settings.languageChinese': '中文',
    'settings.languageEnglish': 'English',

    'header.profileCenter': 'Profile',
    'header.login': 'Log in',
    'header.searchCity': 'Search city',
    'header.getCurrentLocation': 'Use current location',
    'header.locating': 'Locating',
    'header.geolocationUnsupported': 'Your browser does not support geolocation.',
    'header.locationFailedPrefix': 'Failed to get location: ',
    'header.locationDenied': 'permission denied',
    'header.locationUnavailable': 'location unavailable',
    'header.locationTimeout': 'location request timed out',
    'header.locationUnknown': 'unknown error',

    'auth.welcomeBack': 'Welcome back',
    'auth.registerAccount': 'Create account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Log in',
    'auth.register': 'Sign up',
    'auth.noAccount': 'No account yet?',
    'auth.haveAccount': 'Already have an account?',
    'auth.goRegister': 'Sign up',
    'auth.goLogin': 'Log in',
    'auth.genericError': 'Something went wrong. Please try again later.',
    'profile.totalApiUsage': 'Total API usage: ',
    'profile.last30DaysUsage': 'API usage over the last 30 days',
    'profile.apiCalls': 'API calls: {count}',
    'profile.countAxis': 'Count',
    'profile.apiUsage': 'API usage',
    'profile.signOut': 'Sign out',

    'weather.favoriteRemoveAria': 'Remove city from favorites',
    'weather.favoriteAddAria': 'Add city to favorites',
    'weather.favoriteRemoveTitle': 'Favorited, click to remove',
    'weather.favoriteAddTitle': 'Add to favorites',
    'weather.favorited': 'Favorited',
    'weather.favorite': 'Favorite',
    'weather.lastUpdatedBeijing': 'Last updated: Beijing time {time}',
    'weather.localTime': 'Local time {time}',
    'weather.metricsTitle': 'Weather metrics',
    'weather.humidity': 'Humidity',
    'weather.windSpeed': 'Wind speed',
    'weather.pressure': 'Pressure',
    'weather.uv': 'UV',
    'weather.visibility': 'Visibility',
    'weather.precipitation': 'Precipitation',
    'weather.windDirection': 'Wind direction',
    'weather.cloudAmount': 'Cloud cover',
    'weather.temperature': 'Temperature',
    'weather.uvIndex': 'UV index',
    'weather.gust': 'Gust',
    'weather.dewPoint': 'Dew point',
    'weather.hourlyForecastTitle': '24-hour {label} forecast',
    'weather.next24Hours': 'Next 24 hours',
    'weather.viewHourDetails': 'View weather details for {time}',
    'weather.feelsLike': 'Feels like {value}',
    'weather.sunrise': 'Sunrise',
    'weather.sunset': 'Sunset',
    'weather.closeDetails': 'Close weather details',
    'weather.dayPeriod': 'Daytime',
    'weather.nightPeriod': 'Nighttime',
    'weather.rainChance': 'Precipitation chance {value}%',
    'weather.rainProbability': 'Rain {rain}% · Snow {snow}%',
    'weather.relativeHumidity': 'Relative humidity',
    'weather.cloudCoverage': 'Cloud cover',
    'weather.windGust': 'Wind / gust',
    'weather.gustValue': 'Gust {value}',
    'weather.seaLevelPressure': 'Sea-level pressure',
    'weather.dewPointSub': 'Saturation temperature',
    'weather.visibilitySub': 'Horizontal visibility',
    'weather.uvIndexSub': 'UV index',
    'weather.precipSnow': 'Rain / snow',
    'weather.dayWindGust': 'Wind / gust (day)',
    'weather.nightWindGust': 'Wind / gust (night)',
    'weather.dayWindDirection': 'Wind direction (day)',
    'weather.dailyPrecip': 'Daily precipitation',
    'weather.forecast30Title': '30-day weather forecast',
    'weather.weatherDistribution30': '30-day weather distribution',
    'weather.weatherDistribution': 'Weather distribution',
    'weather.daysSuffix': '{value} days',
    'weather.maxTemp': 'High',
    'weather.minTemp': 'Low',
    'weather.avgTemp': 'Average temperature',
    'weather.tempRange': 'Temperature range',
    'weather.tempDiff': 'Temperature range',
    'weather.maxTemperature': 'High temperature',
    'weather.minTemperature': 'Low temperature',
    'weather.cooling': 'Cooling',
    'weather.precipShort': 'Precipitation',
    'weather.calendar': 'Calendar',
    'weather.chart': 'Chart',
    'weather.barChart': 'Bar',
    'weather.lineChart': 'Line',
    'weather.scatterChart': 'Scatter',
    'weather.pieChart': 'Pie',
    'weather.loadFailed': 'Failed to load: {error}',
    'weather.dataSourceFooter': 'Data source: WeatherAPI.com • Last updated: {time}',
    'weather.errorModalMessage': 'Failed to load weather data: {error}\n\nPlease try again later.',

    'favorites.viewWeather': 'View weather for {name}',
    'favorites.loading': 'Loading...',
    'favorites.notLoaded': 'Not loaded',
    'favorites.updating': 'Updating...',
    'favorites.pendingUpdate': 'Pending update',
    'favorites.openDrawer': 'Open favorite cities drawer',
    'favorites.title': 'Favorite cities',
    'favorites.drawerTitle': 'Favorites drawer',
    'favorites.collapseDrawer': 'Collapse favorites drawer',
    'favorites.collapse': 'Collapse',
    'favorites.empty': 'No favorite cities yet',

    'map.title': 'Map location',
    'map.mapView': 'Map view',
    'map.globeView': 'Globe view',
    'map.layersOn': 'Layers: on',
    'map.layerOptions': 'Layer options',
    'map.temperatureLayer': 'Temperature',
    'map.windLayer': 'Wind',
    'map.cloudLayer': 'Clouds',
    'map.precipLayer': 'Precipitation',
    'map.exitFullscreen': 'Exit fullscreen',
    'map.fullscreen': 'Fullscreen',
    'map.zoomOut': 'Zoom out',
    'map.zoomIn': 'Zoom in',
    'map.coordinates': 'Coordinates: {lat}, {lon}',
    'map.temperatureLegend': 'Temperature (C)',
    'map.precipLegend': 'Precipitation (mm)',
    'map.currentLocation': 'Current location',
    'map.viewLocationWeather': 'View weather for this location',
    'map.play': 'Play animation',
    'map.pause': 'Pause animation',
    'map.timelineAria': 'Weather timeline for the next 48 hours',
    'map.timelineOffset': 'T+{hours}h · {time}',
    'map.next48Hours': 'Next 48 hours',

    'chat.openAssistant': 'Open weather assistant',
    'chat.closeAssistant': 'Close weather assistant',
    'chat.title': 'Weather assistant',
    'chat.welcomeTitle': "Hi, I'm your weather assistant",
    'chat.welcomeDescription': 'Ask me about weather for cities around the world',
    'chat.tryAsk': 'Try asking',
    'chat.inputPlaceholder': 'Ask a weather question...',
    'chat.send': 'Send',
    'chat.expandWindow': 'Expand chat window',
    'chat.restoreWindow': 'Restore chat window',
    'chat.requestFailed': 'Request failed',
    'chat.streamReadFailed': 'Unable to read the response stream',
    'chat.genericAssistantError': 'Sorry, something went wrong. Please try again later.',
    'chat.requestProblem': 'Sorry, the request failed: {error}. Please try again later.',
    'chat.unknownError': 'unknown error',
    'chat.quick.localWeather': "What's the weather like here?",
    'chat.quick.snowChina': 'Where is it snowing in China?',
    'chat.quick.rainZhejiang': 'Where is it raining in Zhejiang?',
    'chat.quick.beijingRainTomorrow': 'Will it rain in Beijing tomorrow?',
    'chat.quick.shanghaiWeek': 'Shanghai weather forecast for the next week',
    'chat.quick.hangzhouToday': "What's the weather in Hangzhou today?",
    'chat.quick.shenzhenRain3d': 'Will it rain in Shenzhen in the next 3 days?',
    'chat.quick.chengduUv': 'How strong is the UV in Chengdu?',
    'chat.quick.guangzhouHumidity': 'What is the humidity in Guangzhou now?',
    'chat.quick.nanjingOutdoor': 'Is tomorrow good for outdoor activities in Nanjing?',
    'chat.quick.wuhanWeekend': 'What is the weekend weather in Wuhan?',
    'chat.quick.xianCooling': 'Will Xi’an cool down soon?',
    'chat.quick.suzhouAir': 'How is the air quality in Suzhou?',
    'chat.quick.xiamenWind': 'Is it windy by the sea in Xiamen?',
    'chat.quick.qingdaoTravel': 'Is Qingdao good for travel now?',
    'chat.quick.shanghaiToday': "What's the weather in Shanghai today?",
    'chat.panel.unknownLocation': 'Unknown location',
    'chat.panel.feelsLike': 'Feels like',
    'chat.panel.wind': 'Wind',
    'chat.panel.precipUv': 'Precip / UV',
    'chat.panel.nextDays': 'Next {days} days',
    'chat.panel.rainHumidityUv': 'Rain chance {rain}% · Humidity {humidity}% · UV {uv}',
    'chat.panel.precipHumidityWindUv': 'Precip {precip} mm · Humidity {humidity}% · {windDir} force {windScale} · UV {uv}',
    'chat.panel.queryMatches': 'Matching cities for "{query}"',
    'chat.panel.noCityMatches': 'No matching cities found. Try a more complete city name.',
    'chat.panel.mainCities': 'Major cities nationwide',
    'chat.panel.checkedCities': 'Checked {checked} cities{failed}{updated}',
    'chat.panel.failedCities': ', {count} failed',
    'chat.panel.noConditionMatches': 'No matching locations were found in checked cities.',
    'chat.panel.precipValue': 'Precip {value} mm',
    'chat.panel.windSpeedValue': 'Wind {value} km/h',
    'chat.panel.tool': 'Tool: {name}',
    'chat.tool.currentWeather': 'Current weather',
    'chat.tool.forecast30d': '30-day forecast',
    'chat.tool.locationWeather': 'Current location weather',
    'chat.tool.citySearch': 'City search',
    'chat.tool.candidateCities': 'Candidate cities',
    'chat.tool.batchWeather': 'Batch weather',
    'chat.tool.conditionSearch': 'Regional weather search',
    'chat.tool.agentPlan': 'Agent plan',
    'chat.tool.agentStep': 'Agent step',
    'chat.tool.agentObservation': 'Agent observation',
    'chat.tool.calling': 'Querying {name}...',
    'chat.tool.done': '{name} query complete',
  },
} as const;

type TranslationKey = keyof typeof translations.zh;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh' ? 'en' : 'zh');
  }, [locale, setLocale]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      const table = translations[locale] as Record<string, string>;
      const fallback = translations.zh[key] ?? key;
      return interpolate(table[key] ?? fallback, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}

export function formatDateTimeForLocale(value: string, locale: Locale) {
  try {
    const date = new Date(value.replace(' ', 'T'));
    if (locale === 'en') {
      return new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year} 年 ${month} 月 ${day} 日 ${hours}:${minutes}`;
  } catch {
    return value;
  }
}

export function getWeekdayLabels(locale: Locale) {
  return locale === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['一', '二', '三', '四', '五', '六', '日'];
}

export function getDayOfWeekLabel(date: Date, locale: Locale) {
  const labels =
    locale === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[date.getDay()];
}
