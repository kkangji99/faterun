// 게임에 보이는 모든 말과 이름. 사주 용어는 source/sub 필드에만 작게 남긴다.
// 원칙: 사주를 몰라도 3초 안에 이해되고 웃겨야 한다.

// 오행 = 다섯 가지 "모양". 인덱스 순서가 변신 순서(나무→불→흙→쇠→물→나무).
export const FORMS = [
  { name: '나무', emoji: '🌱', css: '#3fae5a', color: 0x3fae5a, obstacle: '가시덩굴', faint: '베여 쓰러짐', hanja: '木' },
  { name: '불', emoji: '🔥', css: '#ef5a3c', color: 0xef5a3c, obstacle: '불기둥', faint: '꺼져버림', hanja: '火' },
  { name: '흙', emoji: '🪨', css: '#d4a52c', color: 0xd4a52c, obstacle: '바위', faint: '쓸려감', hanja: '土' },
  { name: '쇠', emoji: '⚔️', css: '#9fb0c2', color: 0x9fb0c2, obstacle: '거대 가위', faint: '녹아내림', hanja: '金' },
  { name: '물', emoji: '💧', css: '#3a86e8', color: 0x3a86e8, obstacle: '물폭탄', faint: '말라버림', hanja: '水' },
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
  YEOKMA: { name: '방랑벽', adj: '방랑벽 있는', emoji: '🧳', desc: '가만히 못 있는 팔자. 속도 ×1.3, 점수 ×1.5', source: '역마살', mods: { speedMult: 1.3, scoreMult: 1.5 } },
  DOHWA: { name: '인기쟁이', adj: '인기 많은', emoji: '💘', desc: '코인이 알아서 따라오고, 가끔 장애물이 반해서 비켜줘요', source: '도화살', mods: { magnet: true, swoonChance: 0.08 } },
  HWAGAE: { name: '해탈 도사', adj: '해탈한', emoji: '🧘', desc: '하트가 다 떨어져도 한 번 부활해요', source: '화개살', mods: { revives: 1 } },
  BAEKHO: { name: '돌진 호랑이', adj: '일단 들이받는', emoji: '🐯', desc: '지는 모양으로 부딪혀도 30% 확률로 그냥 들이받아 부숴요', source: '백호살', mods: { tigerChance: 0.3 } },
  NONE: { name: '무난한 팔자', emoji: '🍀', desc: '특별한 스킬은 없지만 하트 +1', source: '신살 없음', mods: { bonusHearts: 1 } },
};

// 오늘의 운세: 오늘 날짜의 오행이 내 본캐와 어떤 사이인지로 정한다.
export const FORTUNES = {
  GENERATES_ME: { title: '귀인이 돕는 날', desc: '시작 하트 +1', stars: 5, mods: { bonusHearts: 1 } },
  I_CONTROL: { title: '재물운 터지는 날', desc: '코인 ×2', stars: 4, mods: { coinMult: 2 } },
  I_GENERATE: { title: '끼 폭발하는 날', desc: '럭키타임 +2초', stars: 4, mods: { luckyBonusMs: 2000 } },
  SAME: { title: '라이벌 출몰의 날', desc: '나랑 같은 모양이 자주 나와요. 같은 편은 그냥 통과!', stars: 3, mods: {} },
  CONTROLS_ME: { title: '천적 출몰의 날', desc: '천적이 자주 나와요. 대신 점수 ×1.5', stars: 2, mods: { scoreMult: 1.5 } },
};

// 사인(死因)
export const DEATH_LINES = {
  LOSE: [
    '{obs}한테 {form} 모양으로 돌진했다가 {faint}',
    '가위바위보 패배: {obs} > {form}',
    '{obs} 앞에서 {form}{으로} 변신한 게 패착',
  ],
  BUMP: ['{obs}에 어정쩡하게 박고 기절', '비기는 모양이라 아프기만 하다 기절'],
};

export const ACKTTEM_COMMENTS = [
  [90, '올해 액운 선결제 완료. 오늘은 뭘 해도 됨'],
  [70, '큰 액은 막았다. 잔챙이는 알아서 피하세요'],
  [40, '반타작. 오늘은 계단 조심'],
  [0, '액땜 실패… 한 판 더 뛰어서 갚으세요'],
];
