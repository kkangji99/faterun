# 운명 피하기: 내 사주대로 달린다

생년월일시로 사주(만세력)를 뽑아 캐릭터·스탯·장애물·기믹이 바뀌는 웹 2D 캐주얼 러너 (Phaser 3).

- 기획서 & 공식: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
- 밸런스 수치: [`src/game/tables.js`](src/game/tables.js)

## 실행

```bash
npm start      # http://localhost:8080 (정적 서버, Phaser는 CDN 로드)
npm test       # 만세력 · 상생상극 · 충돌 로직 단위 테스트
```

조작: `↑`/`Space` 점프, `↓` 슬라이딩 · 모바일은 화면 왼쪽 탭 = 점프, 오른쪽 홀드 = 슬라이딩.

> 재미로 보는 사주 게임입니다. 만세력은 절기 평균일 기반 간이 계산이라 절입일 ±1일은 실제와 다를 수 있습니다.
