/**
 * 判断当前时间是否在日落前后一小时
 * @param sunsetTime 日落时间，格式如 "04:59 PM"
 * @param currentTime 当前时间字符串，格式如 "2025-11-26 16:30"
 * @returns 是否在日落前后一小时
 */
export function isNearSunset(sunsetTime: string, currentTime: string): boolean {
  try {
    // 解析当前时间
    const currentDate = new Date(currentTime.replace(' ', 'T'));
    
    // 解析日落时间（格式：HH:MM AM/PM）
    const [timePart, period] = sunsetTime.split(' ');
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // 转换为24小时制
    let sunsetHours = hours;
    if (period === 'PM' && hours !== 12) {
      sunsetHours = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      sunsetHours = 0;
    }
    
    // 创建日落时间（使用当前日期）
    const sunsetDate = new Date(currentDate);
    sunsetDate.setHours(sunsetHours, minutes, 0, 0);
    
    // 计算日落前后一小时的时间范围
    const oneHourBefore = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
    const oneHourAfter = new Date(sunsetDate.getTime() + 60 * 60 * 1000);
    
    // 判断当前时间是否在范围内
    return currentDate >= oneHourBefore && currentDate <= oneHourAfter;
  } catch (error) {
    console.error('Error parsing sunset time:', error);
    return false;
  }
}

