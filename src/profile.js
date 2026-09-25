// 생년월일시 + 오늘 날짜 → 플레이어 프로필 (본캐, 상성, 팔자 스킬, 오늘의 운세).
// 사주 계산은 saju/* 가 하고, 여기서는 게임 언어로 번역만 한다.

import { STEM_ELEMENT } from './saju/constants.js';
import { REL, relation, elementFor, controllerOf } from './saju/elements.js';
import { computeFourPillars, dayPillar } from './saju/manse.js';
import { countElements, pickYongsin, findShinsal } from './saju/analyze.js';
import { FORMS, CHARACTERS, SKILLS, FORTUNES, josa } from './content.js';

/** 효과 합치기: …Mult 는 곱, 숫자는 합, 불리언은 OR */
export function mergeMods(list) {
  const out = {};
  for (const mods of list) {
    for (const [k, v] of Object.entries(mods)) {
      if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (k.endsWith('Mult')) out[k] = (out[k] ?? 1) * v;
      else out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** "불이 넘치고 물이 텅 빈, 방랑벽 있는 불꽃 폭주족" */
export function summaryLine(counts, skills, character) {
  const most = counts.indexOf(Math.max(...counts));
  const missing = counts.findIndex((c) => c === 0);
  const parts = [];
  if (counts[most] >= 3) parts.push(`${josa(FORMS[most].name, '이', '가')} 넘치고`);
  if (missing >= 0) parts.push(`${josa(FORMS[missing].name, '이', '가')} 텅 빈`);
  let line = parts.length ? parts.join(' ').replace(/넘치고$/, '넘치는') + ', ' : '';
  const skill = skills.find((s) => s !== SKILLS.NONE);
  if (skill) line += `${skill.adj} `;
  return line + character.name;
}

/**
 * @param {{year:number, month:number, day:number, hour?:number|null, minute?:number}} birth
 * @param {{year:number, month:number, day:number}} today
 */
export function createProfile(birth, today) {
  const pillars = computeFourPillars(birth);
  const counts = countElements(pillars);
  const me = STEM_ELEMENT[pillars.day.stem];
  const lucky = pickYongsin(pillars, counts);

  const found = findShinsal(pillars);
  const skills = found.length ? found.map((k) => SKILLS[k]) : [SKILLS.NONE];

  const todayElement = STEM_ELEMENT[dayPillar(today.year, today.month, today.day).stem];
  const fortuneBase = FORTUNES[relation(me, todayElement)];
  const fortune = {
    ...fortuneBase,
    todayElement,
    headline: `오늘은 ${FORMS[todayElement].name} 기운이 강해요. ${josa(FORMS[todayElement].obstacle, '이', '가')} 자주 나와요`,
  };

  const character = CHARACTERS[me];
  const mods = mergeMods([...skills.map((s) => s.mods), fortune.mods]);

  return {
    birth,
    pillars, // 결과 카드의 작은 부제용
    counts,
    me, //                            본캐 모양
    character,
    nemesis: elementFor(me, REL.CONTROLS_ME), // 천적: 나를 이기는 모양
    helper: elementFor(me, REL.GENERATES_ME), // 귀인: 나를 키워주는 모양
    lucky, //                          럭키템(용신)
    fake: controllerOf(lucky), //      짝퉁 럭키템(기신)
    skills,
    fortune,
    mods,
    summary: summaryLine(counts, skills, character),
  };
}
