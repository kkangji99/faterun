// 라이벌 고스트용 기록 저장소 (브라우저 localStorage, 기기별).
// 날짜별 최고 거리만 남기고, "오늘 이전의 가장 최근 날짜" 기록을 어제의 나로 쓴다.
// 저장소 접근은 사생활 보호 모드 등에서 throw 할 수 있으므로 전부 try/catch.

const KEY = 'faterun:records:v1';
const KEEP_DAYS = 14;

export const birthKey = (b) => `${b.year}-${b.month}-${b.day}-${b.hour ?? 'x'}`;

function readAll(storage) {
  try {
    return JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

/** @returns {{date:string, distance:number} | null} todayIso 는 'YYYY-MM-DD' */
export function loadGhost(storage, key, todayIso) {
  const recs = readAll(storage)[key] ?? {};
  const past = Object.keys(recs).filter((d) => d < todayIso).sort();
  if (!past.length) return null;
  const date = past[past.length - 1];
  return { date, distance: recs[date] };
}

export function saveRun(storage, key, todayIso, distance) {
  try {
    const all = readAll(storage);
    const recs = (all[key] ??= {});
    recs[todayIso] = Math.max(recs[todayIso] ?? 0, Math.floor(distance));
    for (const d of Object.keys(recs).sort().slice(0, -KEEP_DAYS)) delete recs[d];
    storage?.setItem(KEY, JSON.stringify(all));
  } catch {
    // 저장 실패해도 게임은 계속된다 (고스트만 없음)
  }
}
