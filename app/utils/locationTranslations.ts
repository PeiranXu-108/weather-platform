/**
 * Location name translation to Chinese
 * Maps common city names, regions, and countries to their Chinese names
 */

// City name mappings (case-insensitive)
export const CITY_NAME_MAP: Record<string, string> = {
  'hangzhou': '杭州',
  'beijing': '北京',
  'shanghai': '上海',
  'guangzhou': '广州',
  'shenzhen': '深圳',
  'chengdu': '成都',
  'chongqing': '重庆',
  'xian': '西安',
  'nanjing': '南京',
  'wuhan': '武汉',
  'tianjin': '天津',
  'suzhou': '苏州',
  'qingdao': '青岛',
  'dalian': '大连',
  'xiamen': '厦门',
  'foshan': '佛山',
  'dongguan': '东莞',
  'changsha': '长沙',
  'zhengzhou': '郑州',
  'jinan': '济南',
  'kunming': '昆明',
  'shenyang': '沈阳',
  'harbin': '哈尔滨',
  'taiyuan': '太原',
  'shijiazhuang': '石家庄',
  'nanchang': '南昌',
  'fuzhou': '福州',
  'hefei': '合肥',
  'yinchuan': '银川',
  'lanzhou': '兰州',
  'xining': '西宁',
  'urumqi': '乌鲁木齐',
  'lhasa': '拉萨',
  'jinhua': '金华',
  'wenzhou': '温州',
  'lishui': '丽水',
  'taizhou': '台州',
  'yongxian': '永县',
  'yongchuan': '永川',
  'hong kong': '香港',
  'macau': '澳门',
  'taipei': '台北',
  'kaohsiung': '高雄',
  'taichung': '台中',
  'tainan': '台南',
  // International cities
  'tokyo': '东京',
  'osaka': '大阪',
  'kyoto': '京都',
  'seoul': '首尔',
  'singapore': '新加坡',
  'bangkok': '曼谷',
  'kuala lumpur': '吉隆坡',
  'jakarta': '雅加达',
  'manila': '马尼拉',
  'ho chi minh city': '胡志明市',
  'hanoi': '河内',
  'new york': '纽约',
  'los angeles': '洛杉矶',
  'chicago': '芝加哥',
  'san francisco': '旧金山',
  'boston': '波士顿',
  'washington': '华盛顿',
  'london': '伦敦',
  'paris': '巴黎',
  'berlin': '柏林',
  'rome': '罗马',
  'madrid': '马德里',
  'moscow': '莫斯科',
  'sydney': '悉尼',
  'melbourne': '墨尔本',
  'madison': '麦迪逊',
};

// Region/Province/State name mappings
export const REGION_NAME_MAP: Record<string, string> = {
  'zhejiang': '浙江',
  'jiangsu': '江苏',
  'guangdong': '广东',
  'shandong': '山东',
  'henan': '河南',
  'sichuan': '四川',
  'hubei': '湖北',
  'hunan': '湖南',
  'anhui': '安徽',
  'hebei': '河北',
  'jiangxi': '江西',
  'shanxi': '山西',
  'liaoning': '辽宁',
  'fujian': '福建',
  'shaanxi': '陕西',
  'heilongjiang': '黑龙江',
  'yunnan': '云南',
  'guizhou': '贵州',
  'jilin': '吉林',
  'gansu': '甘肃',
  'xinjiang': '新疆',
  'tibet': '西藏',
  'qinghai': '青海',
  'ningxia': '宁夏',
  'guangxi': '广西',
  'inner mongolia': '内蒙古',
  'beijing': '北京',
  'tianjin': '天津',
  'shanghai': '上海',
  'chongqing': '重庆',
  'hong kong': '香港',
  'macau': '澳门',
  'taiwan': '台湾',
};

// Country name mappings
export const COUNTRY_NAME_MAP: Record<string, string> = {
  'china': '中国',
  'united states of america': '美国',
  'usa': '美国',
  'united kingdom': '英国',
  'uk': '英国',
  'japan': '日本',
  'south korea': '韩国',
  'korea': '韩国',
  'singapore': '新加坡',
  'thailand': '泰国',
  'malaysia': '马来西亚',
  'indonesia': '印度尼西亚',
  'philippines': '菲律宾',
  'vietnam': '越南',
  'india': '印度',
  'russia': '俄罗斯',
  'germany': '德国',
  'france': '法国',
  'italy': '意大利',
  'spain': '西班牙',
  'australia': '澳大利亚',
  'canada': '加拿大',
  'brazil': '巴西',
  'mexico': '墨西哥',
  'argentina': '阿根廷',
  'south africa': '南非',
  'egypt': '埃及',
  'turkey': '土耳其',
  'saudi arabia': '沙特阿拉伯',
  'uae': '阿联酋',
  'united arab emirates': '阿联酋',
  'israel': '以色列',
  'new zealand': '新西兰',
  'switzerland': '瑞士',
  'netherlands': '荷兰',
  'belgium': '比利时',
  'austria': '奥地利',
  'sweden': '瑞典',
  'norway': '挪威',
  'denmark': '丹麦',
  'finland': '芬兰',
  'poland': '波兰',
  'portugal': '葡萄牙',
  'greece': '希腊',
  'ireland': '爱尔兰',
  'czech republic': '捷克',
  'hungary': '匈牙利',
  'romania': '罗马尼亚',
  'ukraine': '乌克兰',
  'belarus': '白俄罗斯',
  'kazakhstan': '哈萨克斯坦',
  'mongolia': '蒙古',
  'north korea': '朝鲜',
  'myanmar': '缅甸',
  'cambodia': '柬埔寨',
  'laos': '老挝',
  'bangladesh': '孟加拉国',
  'pakistan': '巴基斯坦',
  'afghanistan': '阿富汗',
  'iran': '伊朗',
  'iraq': '伊拉克',
  'syria': '叙利亚',
  'lebanon': '黎巴嫩',
  'jordan': '约旦',
  'kuwait': '科威特',
  'qatar': '卡塔尔',
  'bahrain': '巴林',
  'oman': '阿曼',
  'yemen': '也门',
};

/**
 * Translate location name to Chinese
 * @param name - The location name to translate
 * @param type - Type of location: 'city', 'region', or 'country'
 * @returns Chinese name if found, otherwise returns original name
 */
export function translateLocationName(
  name: string,
  type: 'city' | 'region' | 'country' = 'city'
): string {
  if (!name) return name;
  
  const normalizedName = name.trim().toLowerCase();
  
  // Try specific type mapping first
  let map: Record<string, string>;
  switch (type) {
    case 'city':
      map = CITY_NAME_MAP;
      break;
    case 'region':
      map = REGION_NAME_MAP;
      break;
    case 'country':
      map = COUNTRY_NAME_MAP;
      break;
  }
  
  if (map[normalizedName]) {
    return map[normalizedName];
  }
  
  // If not found in specific type, try all maps (for flexibility)
  if (type !== 'city' && CITY_NAME_MAP[normalizedName]) {
    return CITY_NAME_MAP[normalizedName];
  }
  if (type !== 'region' && REGION_NAME_MAP[normalizedName]) {
    return REGION_NAME_MAP[normalizedName];
  }
  if (type !== 'country' && COUNTRY_NAME_MAP[normalizedName]) {
    return COUNTRY_NAME_MAP[normalizedName];
  }
  
  // If still not found, return original (might already be in Chinese or not in our map)
  return name;
}

/**
 * Translate full location object to Chinese
 */
export function translateLocation(location: {
  name: string;
  region: string;
  country: string;
}): {
  name: string;
  region: string;
  country: string;
} {
  return {
    name: translateLocationName(location.name, 'city'),
    region: translateLocationName(location.region, 'region'),
    country: translateLocationName(location.country, 'country'),
  };
}

