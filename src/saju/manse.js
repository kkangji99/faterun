// 간이 만세력: 양력 생년월일시 → 사주 4기둥(년·월·일·시).
//
// - 일주: 율리우스 적일(JDN) 기반. 기준점 2000-01-01 = 戊午일, 1900-01-01 = 甲戌일.
// - 년주: 입춘(≈2월 4일) 기준으로 해가 바뀐다.
// - 월주: 12절기(節)의 "평균 날짜"로 월지를 정한다. 절입일 당일 ±1일은 실제와
//         다를 수 있으므로 정식 서비스에서는 절기 시각 테이블(KASI 데이터 등)로 교체할 것.
// - 시주: 2시간 단위 12지. 23시 이후는 옵션에 따라 다음 날 일주를 쓴다(조자시 방식).
//
// 입력은 모두 "출생지 현지 시각"의 숫자이며, Date 객체를 쓰지 않아 타임존 영향을 받지 않는다.

// [월, 일, 월지] — 해당 날짜부터 그 월지가 시작된다.
const SOLAR_TERM_STARTS = [
  [1, 6, 1], //  소한 → 丑월
  [2, 4, 2], //  입춘 → 寅월
  [3, 6, 3], //  경칩 → 卯월
  [4, 5, 4], //  청명 → 辰월
  [5, 6, 5], //  입하 → 巳월
  [6, 6, 6], //  망종 → 午월
  [7, 7, 7], //  소서 → 未월
  [8, 8, 8], //  입추 → 申월
  [9, 8, 9], //  백로 → 酉월
  [10, 8, 10], // 한로 → 戌월
  [11, 7, 11], // 입동 → 亥월
  [12, 7, 0], //  대설 → 子월
];

const mod = (n, m) => ((n % m) + m) % m;

export function julianDayNumber(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

const fromCycle = (idx60) => ({ stem: idx60 % 10, branch: idx60 % 12 });

export function dayPillar(year, month, day) {
  return fromCycle(mod(julianDayNumber(year, month, day) + 49, 60));
}

export function yearPillar(year, month, day) {
  const beforeIpchun = month < 2 || (month === 2 && day < 4);
  const sajuYear = beforeIpchun ? year - 1 : year;
  return fromCycle(mod(sajuYear - 4, 60));
}

export function monthPillar(year, month, day) {
  let branch = 0; // 1/1~1/5 는 전년도 대설 이후이므로 子월
  for (const [m, d, b] of SOLAR_TERM_STARTS) {
    if (month > m || (month === m && day >= d)) branch = b;
  }
  const yearStem = yearPillar(year, month, day).stem;
  // 연간별 寅월 천간(월두법): 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  const yinStem = mod((yearStem % 5) * 2 + 2, 10);
  const orderFromYin = mod(branch - 2, 12);
  return { stem: mod(yinStem + orderFromYin, 10), branch };
}

export function hourPillar(dayStem, hour) {
  const branch = Math.floor((hour + 1) / 2) % 12;
  // 일간별 子시 천간(시두법): 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬
  return { stem: mod((dayStem % 5) * 2 + branch, 10), branch };
}

function addDays(year, month, day, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/**
 * @param {{year:number, month:number, day:number, hour?:number|null, minute?:number}} birth
 *        hour 가 null/undefined 이면 시주를 모르는 것으로 보고 6글자만 계산한다.
 * @param {{lateZiNextDay?: boolean, minuteOffset?: number}} [opts]
 *        minuteOffset: 진태양시 보정(서울 약 -32분). 기본 0.
 */
export function computeFourPillars(birth, opts = {}) {
  const { lateZiNextDay = true, minuteOffset = 0 } = opts;
  let { year, month, day } = birth;
  let hour = birth.hour ?? null;

  if (hour !== null) {
    let total = hour * 60 + (birth.minute ?? 0) + minuteOffset;
    const dayShift = Math.floor(total / 1440);
    total = mod(total, 1440);
    [year, month, day] = addDays(year, month, day, dayShift);
    hour = Math.floor(total / 60);
  }

  const [dy, dm, dd] = hour !== null && hour >= 23 && lateZiNextDay ? addDays(year, month, day, 1) : [year, month, day];
  const dayP = dayPillar(dy, dm, dd);

  return {
    year: yearPillar(year, month, day),
    month: monthPillar(year, month, day),
    day: dayP,
    hour: hour === null ? null : hourPillar(dayP.stem, hour),
  };
}
