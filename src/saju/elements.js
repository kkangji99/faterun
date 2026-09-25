// 오행 상생·상극 관계 판정.
//
//   상생: 木→火→土→金→水→木   generates(a, b)  ⇔ (a + 1) % 5 === b
//   상극: 木→土→水→火→金→木   controls(a, b)   ⇔ (a + 2) % 5 === b
//
// 일간(me) 기준으로 상대 오행(other)과의 관계를 십신 계열 5종으로 분류한다.
//   diff = (other - me + 5) % 5
//   0 SAME          비겁 — 같은 기운
//   1 I_GENERATE    식상 — 내가 생함(기운이 빠져나감)
//   2 I_CONTROL     재성 — 내가 극함(내가 이김)
//   3 CONTROLS_ME   관성 — 나를 극함(상극, 위험)
//   4 GENERATES_ME  인성 — 나를 생함(상생, 버프)

export const REL = Object.freeze({
  SAME: 'SAME',
  I_GENERATE: 'I_GENERATE',
  I_CONTROL: 'I_CONTROL',
  CONTROLS_ME: 'CONTROLS_ME',
  GENERATES_ME: 'GENERATES_ME',
});

const REL_BY_DIFF = [REL.SAME, REL.I_GENERATE, REL.I_CONTROL, REL.CONTROLS_ME, REL.GENERATES_ME];

export const generates = (a, b) => (a + 1) % 5 === b;
export const controls = (a, b) => (a + 2) % 5 === b;

export function relation(me, other) {
  return REL_BY_DIFF[(other - me + 5) % 5];
}

/** 일간 me 에 대해 특정 관계에 해당하는 오행을 돌려준다. (relation 의 역함수) */
export function elementFor(me, rel) {
  return (me + REL_BY_DIFF.indexOf(rel)) % 5;
}

/** element 를 극하는 오행 */
export const controllerOf = (element) => (element + 3) % 5;
/** element 를 생하는 오행 */
export const motherOf = (element) => (element + 4) % 5;
