// 오행/천간/지지 기본 상수.
// 오행 인덱스 순서는 상생 순환 순서(木→火→土→金→水)를 따른다.
// 이 순서 덕분에 상생은 (i+1)%5, 상극은 (i+2)%5 로 계산된다.

export const WOOD = 0;
export const FIRE = 1;
export const EARTH = 2;
export const METAL = 3;
export const WATER = 4;

export const ELEMENTS = [
  { id: WOOD, key: 'WOOD', hanja: '木', ko: '목', color: 0x3fae5a },
  { id: FIRE, key: 'FIRE', hanja: '火', ko: '화', color: 0xe8453c },
  { id: EARTH, key: 'EARTH', hanja: '土', ko: '토', color: 0xc9a227 },
  { id: METAL, key: 'METAL', hanja: '金', ko: '금', color: 0xb8c2cc },
  { id: WATER, key: 'WATER', hanja: '水', ko: '수', color: 0x2f6fd6 },
];

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
// 천간 오행: 甲乙木 丙丁火 戊己土 庚辛金 壬癸水
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];

export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
// 지지 본기 오행: 子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
export const BRANCH_ANIMAL = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

export const pillarLabel = (p) => (p ? `${STEMS[p.stem]}${BRANCHES[p.branch]}` : '??');
export const pillarLabelKo = (p) => (p ? `${STEMS_KO[p.stem]}${BRANCHES_KO[p.branch]}` : '??');
