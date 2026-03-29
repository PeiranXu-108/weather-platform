export const CITY_NAME_MAP: Record<string, string> = {
  beijing: '北京',
  tianjin: '天津',
  shanghai: '上海',
  chongqing: '重庆',
  guangzhou: '广州',
  shenzhen: '深圳',
  hangzhou: '杭州',
  suzhou: '苏州',
  nanjing: '南京',
  wuhan: '武汉',
  changsha: '长沙',
  chengdu: '成都',
  xian: '西安',
  kunming: '昆明',
  haikou: '海口',
  sanya: '三亚',
  qingdao: '青岛',
  jinan: '济南',
  shijiazhuang: '石家庄',
  taiyuan: '太原',
  zhengzhou: '郑州',
  xiamen: '厦门',
  fuzhou: '福州',
  dalian: '大连',
  shenyang: '沈阳',
  changchun: '长春',
  haerbin: '哈尔滨',
  hongkong: '香港',
  macau: '澳门',
  taipei: '台北',
  tokyo: '东京',
  osaka: '大阪',
  seoul: '首尔',
  singapore: '新加坡',
  bangkok: '曼谷',
  jakarta: '雅加达',
  newyork: '纽约',
  losangeles: '洛杉矶',
  london: '伦敦',
  paris: '巴黎',
  berlin: '柏林',
  madrid: '马德里',
  rome: '罗马',
  moscow: '莫斯科',
  sydney: '悉尼',
  melbourne: '墨尔本',
};

export const REGION_NAME_MAP: Record<string, string> = {
  zhejiang: '浙江',
  jiangsu: '江苏',
  guangdong: '广东',
  shandong: '山东',
  henan: '河南',
  sichuan: '四川',
  hubei: '湖北',
  hunan: '湖南',
  fujian: '福建',
};

export const COUNTRY_NAME_MAP: Record<string, string> = {
  china: '中国',
  usa: '美国',
  'united states': '美国',
  japan: '日本',
  'south korea': '韩国',
  singapore: '新加坡',
  thailand: '泰国',
  germany: '德国',
  france: '法国',
  italy: '意大利',
  uk: '英国',
  'united kingdom': '英国',
  australia: '澳大利亚',
  canada: '加拿大',
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

export function translateLocationName(
  name: string,
  type: 'city' | 'region' | 'country' = 'city'
): string {
  if (!name) return name;
  const key = normalize(name);
  const specificMap =
    type === 'city' ? CITY_NAME_MAP : type === 'region' ? REGION_NAME_MAP : COUNTRY_NAME_MAP;
  return specificMap[key] ?? CITY_NAME_MAP[key] ?? REGION_NAME_MAP[key] ?? COUNTRY_NAME_MAP[key] ?? name;
}

export function translateLocation(location: {
  name: string;
  region: string;
  country: string;
}) {
  return {
    name: translateLocationName(location.name, 'city'),
    region: translateLocationName(location.region, 'region'),
    country: translateLocationName(location.country, 'country'),
  };
}
