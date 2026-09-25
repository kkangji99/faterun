// 게임에 보이는 모든 말과 이름. 사주 용어는 source/sub 필드에만 작게 남긴다.
// 원칙: 사주를 몰라도 3초 안에 이해되고 웃겨야 한다.

// 오행 = 다섯 가지 색깔. 떨어지는 물체(obstacle)와 움직임(move)이 오행마다 다르다.
export const FORMS = [
  { name: '나무', emoji: '🌱', css: '#3fae5a', color: 0x3fae5a, obstacle: '가시덩굴', move: '땅에서 쑥 솟아요', faint: '베여 쓰러짐', hanja: '木' },
  { name: '불', emoji: '🔥', css: '#ef5a3c', color: 0xef5a3c, obstacle: '불똥', move: '떨어져서 데굴데굴 굴러요', faint: '꺼져버림', hanja: '火' },
  { name: '흙', emoji: '🪨', css: '#d4a52c', color: 0xd4a52c, obstacle: '바위', move: '빠르게 쿵 떨어져요', faint: '쓸려감', hanja: '土' },
  { name: '쇠', emoji: '⚔️', css: '#9fb0c2', color: 0x9fb0c2, obstacle: '가위', move: '지그재그로 떨어져요', faint: '녹아내림', hanja: '金' },
  { name: '물', emoji: '💧', css: '#3a86e8', color: 0x3a86e8, obstacle: '물폭탄', move: '바닥에서 펑 터져요', faint: '말라버림', hanja: '水' },
];

// 받침 유무에 맞는 조사
const hasBatchim = (word) => (word.charCodeAt(word.length - 1) - 0xac00) % 28 !== 0;
export const josa = (word, withB, withoutB) => word + (hasBatchim(word) ? withB : withoutB);

// 본캐 = 태어난 날의 오행(일간)
export const CHARACTERS = [
  { name: '고집 센 새싹', tagline: '꺾일지언정 굽히지 않는 타입' },
  { name: '불꽃 폭주족', tagline: '일단 지르고 수습은 나중에 하는 타입' },
  { name: '듬직한 돌하르방', tagline: '움직이긴 싫지만 믿음직한 타입' },
  { name: '칼같은 로봇', tagline: '맺고 끊음이 확실한 타입' },
  { name: '말랑 슬라임', tagline: '어디든 스며드는 타입' },
];

// 팔자 스킬 = 신살. 없으면 "무난한 팔자".
export const SKILLS = {
  YEOKMA: { name: '방랑벽', adj: '방랑벽 있는', emoji: '🧳', desc: '가만히 못 있는 팔자. 이동 속도 ×1.3, 점수 ×1.5', source: '역마살', mods: { speedMult: 1.3, scoreMult: 1.5 } },
  DOHWA: { name: '인기쟁이', adj: '인기 많은', emoji: '💘', desc: '친구·코인이 알아서 따라오고, 가끔 운명이 반해서 비켜가요', source: '도화살', mods: { magnet: true, swoonChance: 0.08 } },
  HWAGAE: { name: '해탈 도사', adj: '해탈한', emoji: '🧘', desc: '하트가 다 떨어져도 한 번 부활해요', source: '화개살', mods: { revives: 1 } },
  BAEKHO: { name: '돌진 호랑이', adj: '일단 들이받는', emoji: '🐯', desc: '부딪혀도 30% 확률로 들이받아 튕겨내요', source: '백호살', mods: { tigerChance: 0.3 } },
  NONE: { name: '무난한 팔자', emoji: '🍀', desc: '특별한 스킬은 없지만 하트 +1', source: '신살 없음', mods: { bonusHearts: 1 } },
};

// 오늘의 운세: 오늘 날짜의 오행이 내 본캐와 어떤 사이인지로 정한다.
export const FORTUNES = {
  GENERATES_ME: { title: '귀인이 돕는 날', desc: '시작 하트 +1', stars: 5, mods: { bonusHearts: 1 } },
  I_CONTROL: { title: '재물운 터지는 날', desc: '코인 ×2', stars: 4, mods: { coinMult: 2 } },
  I_GENERATE: { title: '끼 폭발하는 날', desc: '럭키타임 +2초', stars: 4, mods: { luckyBonusMs: 2000 } },
  SAME: { title: '친구 많은 날', desc: '럭키타임 +1초', stars: 3, mods: { luckyBonusMs: 1000 } },
  CONTROLS_ME: { title: '천적 출몰의 날', desc: '대신 점수 ×1.5', stars: 2, mods: { scoreMult: 1.5 } },
};

// 사인(死因): 마지막에 맞은 게 천적이었는지에 따라
export const DEATH_LINES = {
  NEMESIS: [
    '하늘에서 떨어진 천적 {obs}에 정수리를 맞고 {faint}',
    '천적 {obs}의 집요한 추격 끝에 {faint}',
    '{obs} 피하다 {obs}에 맞음. 역시 천적',
  ],
  OTHER: [
    '방심한 사이 {obs}에 맞고 {faint}',
    '{obs이} 떨어지는 건 봤는데 발이 안 움직임',
    '아슬아슬을 노리다 진짜 {obs}에 맞음',
  ],
};

export const ACKTTEM_COMMENTS = [
  [90, '올해 액운 선결제 완료. 오늘은 뭘 해도 됨'],
  [70, '큰 액은 막았다. 잔챙이는 알아서 피하세요'],
  [40, '반타작. 오늘은 계단 조심'],
  [0, '액땜 실패… 한 판 더 뛰어서 갚으세요'],
];
