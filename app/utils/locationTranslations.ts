/**
 * Location name translation to Chinese
 * Maps common city names, regions, and countries to their Chinese names
 */

// City name mappings (case-insensitive)
export const CITY_NAME_MAP: Record<string, string> = {
  "beijing": "北京",
  "tianjin": "天津",
  "shanghai": "上海",
  "chongqing": "重庆",
  "guangzhou": "广州",
  "shenzhen": "深圳",
  "hangzhou": "杭州",
  "ningbo": "宁波",
  "wenzhou": "温州",
  "suzhou": "苏州",
  "wuxi": "无锡",
  "nanjing": "南京",
  "changzhou": "常州",
  "xuzhou": "徐州",
  "nantong": "南通",
  "lianyungang": "连云港",
  "yancheng": "盐城",
  "yangzhou": "扬州",
  "zhenjiang": "镇江",
  "shaoxing": "绍兴",
  "jiaxing": "嘉兴",
  "huzhou": "湖州",
  "ningde": "宁德",
  "fuzhou": "福州",
  "xiamen": "厦门",
  "quanzhou": "泉州",
  "zhangzhou": "漳州",
  "putian": "莆田",
  "zhuhai": "珠海",
  "foshan": "佛山",
  "dongguan": "东莞",
  "zhongshan": "中山",
  "shantou": "汕头",
  "chaozhou": "潮州",
  "jiangmen": "江门",
  "heyuan": "河源",
  "huizhou": "惠州",
  "zhengzhou": "郑州",
  "luoyang": "洛阳",
  "kaifeng": "开封",
  "xiangyang": "襄阳",
  "wuhan": "武汉",
  "yueyang": "岳阳",
  "changsha": "长沙",
  "zhuzhou": "株洲",
  "xiangtan": "湘潭",
  "chenzhou": "郴州",
  "changde": "常德",  
  "nanchang": "南昌",
  "jiujiang": "九江",
  "jingdezhen": "景德镇",
  "yingtan": "鹰潭",
  "fuzhou_jx": "抚州",
  "ganzhou": "赣州",
  "yibin": "宜宾",
  "chengdu": "成都",
  "mianyang": "绵阳",
  "dazhou": "达州",
  "neijiang": "内江",
  "luzhou": "泸州",
  "bazhong": "巴中",
  "nanchong": "南充",
  "leshan": "乐山",
  "suining": "遂宁",
  "shanwei": "汕尾",
  "kunming": "昆明",
  "kunshan": "昆山",
  "lasa": "拉萨",
  "urumqi": "乌鲁木齐",
  "yinchuan": "银川",
  "lanzhou": "兰州",
  "xining": "西宁",
  "haerbin": "哈尔滨",
  "shenyang": "沈阳",
  "dalian": "大连",
  "changchun": "长春",
  "qingdao": "青岛",
  "shijiazhuang": "石家庄",
  "taiyuan": "太原",
  "jinan": "济南",
  "xian": "西安",
  "xianyang": "咸阳",
  "zhongwei": "中卫",
  "wulumuqi": "乌鲁木齐",
  "huhehaote": "呼和浩特",
  "baotou": "包头",
  "wuhai": "乌海",
  "nanning": "南宁",
  "liuzhou": "柳州",
  "guilin": "桂林",
  "beihai": "北海",
  "haikou": "海口",
  "sanya": "三亚",
  "xianggang": "香港",
  "aomen": "澳门",
  "taipei": "台北",
  "kaohsiung": "高雄",
  "taichung": "台中",
  "tainan": "台南",
  // International cities
  // 新增城市 —— 欧美 / 美洲
"toronto": "多伦多",
"new york": "纽约",
"los angeles": "洛杉矶",
"chicago": "芝加哥",
"houston": "休斯顿",
"atlanta": "亚特兰大",
"miami": "迈阿密",
"seattle": "西雅图",
"washington": "华盛顿",
"boston": "波士顿",
"san francisco": "旧金山",
"san diego": "圣地亚哥",
"san jose": "圣何塞",
"san antonio": "圣安东尼奥",
"austin": "奥斯汀",
"columbus": "哥伦布",
"denver": "丹佛",
"detroit": "底特律",
"el paso": "埃尔帕索",
"fort worth": "沃思堡",
"gainesville": "盖恩斯维尔",
"irving": "欧文",
"jacksonville": "杰克逊维尔",
"kansas city": "堪萨斯城",
"las vegas": "拉斯维加斯",
"long beach": "长滩",
"memphis": "孟菲斯",
"milwaukee": "密尔沃基",
"nashville": "纳什维尔",
"oklahoma city": "俄克拉荷马城",
"omaha": "奥马哈",
"phoenix": "凤凰城",
"portland": "波特兰",
"sacramento": "萨克拉门托",
"madrid": "马德里",
"madison":"麦迪逊",
"montreal": "蒙特利尔",
"mexico city": "墨西哥城",
"buenos aires": "布宜诺斯艾利斯",
"rio de janeiro": "里约热内卢",
"saint petersburg": "圣彼得堡",
"istanbul": "伊斯坦布尔",
"amsterdam": "阿姆斯特丹",
"barcelona": "巴塞罗那",
"milan": "米兰",
"vedenie": "???", // 注：若无标准译名，可保留原拼写  
"dubai": "迪拜",
"cape town": "开普敦",



// 亚洲 / 亚太
"delhi": "德里",
"mumbai": "孟买",
"bangalore": "班加罗尔",
"hong kong": "香港",  // 已有，但重复也可
"busan": "釜山",
"nagoya": "名古屋",
"tokyo": "东京",
"osaka": "大阪",
"kyoto": "京都",
"hiroshima": "广岛",
"nagasaki": "长崎",
"okinawa": "冲绳",
"fukuoka": "福冈",
"sapporo": "札幌",
"sendai": "仙台",
"chiba": "千叶",
"kobe": "神户",
"ho chi minh city": "胡志明市", // 已有
"manila": "马尼拉",             // 已有
"singapore": "新加坡",
"sydney": "悉尼",
"melbourne": "墨尔本",
"brisbane": "布里斯班",
"adelaide": "阿德莱德",
"perth": "珀斯",
"hobart": "霍巴特",
"darwin": "达尔文",
"canberra": "堪培拉",
"wellington": "惠灵顿",

// 非洲 / 中东 / 拉美等
"cairo": "开罗",
"lagos": "拉各斯",
"kinshasa": "金沙萨",
"nairobi": "内罗毕",
"jakarta": "雅加达", // 已有
"bangkok": "曼谷",   // 已有

// 补充新城
"sao paulo": "圣保罗",
"bengaluru": "班加罗尔",  // 同 “bangalore”
"karachi": "卡拉奇",
"tehran": "德黑兰",
"lisbon": "里斯本",
"vienna": "维也纳",
"zurich": "苏黎世",
"helsinki": "赫尔辛基",
"budapest": "布达佩斯",
"prague": "布拉格"
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

