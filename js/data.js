/**
 * Roameo — destination data
 *
 * Loaded before js/app.js via a plain <script> tag (no bundler / module
 * system), so CATS and DESTINATIONS are declared as top-level `const`
 * bindings. Classic (non-module) scripts on the same page share one global
 * scope, so app.js can reference them directly without imports.
 */

const CATS = ['전체', '자연', '바다', '도시', '역사', '체험'];

// `l` / `d` are the seed like / dislike counts. A user's own vote is layered
// on top at read time in app.js (likesOf/dislikesOf) so it stays reversible.
const DESTINATIONS = [
  { id: 'jeju', name: '제주도', region: '제주', category: '자연', desc: '화산섬의 오름과 에메랄드빛 해변이 펼쳐지는 힐링 여행지.', grad: 'linear-gradient(150deg,#1e8f6a,#0f6a72)', l: 342, d: 12 },
  { id: 'seoul', name: '서울', region: '서울', category: '도시', desc: '고궁과 미래가 공존하는 대한민국의 심장, 매일이 새로운 도시.', grad: 'linear-gradient(150deg,#41599b,#5a4a8f)', l: 289, d: 21 },
  { id: 'busan', name: '부산', region: '부산', category: '바다', desc: '해운대 백사장과 감천문화마을, 활기찬 항구 도시의 낭만.', grad: 'linear-gradient(150deg,#2a72a8,#158a94)', l: 301, d: 15 },
  { id: 'gyeongju', name: '경주', region: '경상북도', category: '역사', desc: '천년 신라의 숨결이 살아있는 지붕 없는 야외 박물관.', grad: 'linear-gradient(150deg,#a8792e,#7a5230)', l: 176, d: 9 },
  { id: 'gangneung', name: '강릉', region: '강원도', category: '바다', desc: '커피거리와 경포 해변, 동해의 일출을 만나는 곳.', grad: 'linear-gradient(150deg,#248a9b,#2a689e)', l: 214, d: 11 },
  { id: 'jeonju', name: '전주', region: '전라북도', category: '체험', desc: '한옥마을 골목과 비빔밥, 전통과 미식이 어우러진 도시.', grad: 'linear-gradient(150deg,#8a4a9e,#a8517a)', l: 198, d: 8 },
  { id: 'yeosu', name: '여수', region: '전라남도', category: '바다', desc: '반짝이는 밤바다와 낭만 포차, 케이블카가 있는 남해의 보석.', grad: 'linear-gradient(150deg,#1f6a7c,#245f92)', l: 233, d: 7 },
  { id: 'andong', name: '안동', region: '경상북도', category: '역사', desc: '하회마을과 전통 고택에서 느리게 흐르는 시간을 걷다.', grad: 'linear-gradient(150deg,#8a6538,#664329)', l: 121, d: 14 },
  { id: 'tongyeong', name: '통영', region: '경상남도', category: '바다', desc: '케이블카에서 내려다보는 한려수도와 벽화마을 동피랑.', grad: 'linear-gradient(150deg,#1f9276,#238a9b)', l: 156, d: 6 },
  { id: 'sokcho', name: '속초', region: '강원도', category: '자연', desc: '웅장한 설악산과 청초호, 산과 바다를 한번에 즐기는 여행.', grad: 'linear-gradient(150deg,#2f8047,#1f6a7c)', l: 187, d: 10 },
  { id: 'damyang', name: '담양', region: '전라남도', category: '자연', desc: '바람에 사각이는 죽녹원 대나무숲을 걷는 초록빛 산책.', grad: 'linear-gradient(150deg,#358a44,#5e8a2e)', l: 98, d: 5 },
  { id: 'namhae', name: '남해', region: '경상남도', category: '자연', desc: '계단식 다랑이논과 이국적인 독일마을이 있는 해안 절경.', grad: 'linear-gradient(150deg,#1f9e7e,#238a9b)', l: 134, d: 6 }
];

// A few starter reviews per seed destination, shown in the "자세히" detail
// view alongside anything users add later (see roameo_reviews in app.js).
const SEED_REVIEWS = {
  jeju: [
    { name: '민지', rating: 5, comment: '오름 노을이 진짜 예술이에요. 다음에 또 가고 싶어요.' },
    { name: '재현', rating: 4, comment: '렌트카 필수! 대중교통만으로는 조금 불편해요.' }
  ],
  seoul: [
    { name: '하늘', rating: 5, comment: '고궁 야간개장 꼭 가보세요, 사진 맛집입니다.' },
    { name: '수빈', rating: 4, comment: '볼거리는 많은데 사람이 너무 많아요.' }
  ],
  busan: [
    { name: '도윤', rating: 5, comment: '감천문화마을 골목골목이 다 포토존이에요.' },
    { name: '예은', rating: 4, comment: '해운대 밤바다 산책 강추합니다.' }
  ],
  gyeongju: [
    { name: '지훈', rating: 5, comment: '대릉원 야경이 생각보다 훨씬 예뻐요.' },
    { name: '서연', rating: 4, comment: '자전거로 돌아다니기 딱 좋은 도시였어요.' }
  ],
  gangneung: [
    { name: '다은', rating: 5, comment: '커피거리 카페들 퀄리티가 다 좋아요.' },
    { name: '준서', rating: 4, comment: '일출 보려면 새벽에 일찍 움직이세요.' }
  ],
  jeonju: [
    { name: '유진', rating: 5, comment: '한옥마을 야경이랑 길거리 음식 최고였어요.' },
    { name: '민재', rating: 3, comment: '주말엔 사람이 많아서 좀 복잡해요.' }
  ],
  yeosu: [
    { name: '소율', rating: 5, comment: '밤바다 케이블카 야경 진짜 낭만적이에요.' },
    { name: '현우', rating: 4, comment: '포차거리 회+소주 조합 안 먹으면 후회합니다.' }
  ],
  andong: [
    { name: '세아', rating: 4, comment: '하회마을 고즈넉한 분위기가 힐링됩니다.' },
    { name: '동현', rating: 4, comment: '찜닭 맛집 많으니 꼭 챙겨 드세요.' }
  ],
  tongyeong: [
    { name: '가은', rating: 5, comment: '케이블카에서 본 한려수도 뷰가 예술이에요.' },
    { name: '태윤', rating: 4, comment: '동피랑 벽화마을 계단이 꽤 있어서 편한 신발 필수.' }
  ],
  sokcho: [
    { name: '나윤', rating: 5, comment: '설악산 단풍 시즌에 가면 정말 후회 없어요.' },
    { name: '준혁', rating: 4, comment: '중앙시장 닭강정 꼭 드셔보세요.' }
  ],
  damyang: [
    { name: '은서', rating: 5, comment: '죽녹원 대나무숲 바람소리가 힐링 그 자체예요.' },
    { name: '시우', rating: 4, comment: '메타세쿼이아길이랑 같이 묶어서 가면 좋아요.' }
  ],
  namhae: [
    { name: '하린', rating: 5, comment: '다랑이논 뷰가 이국적이라 사진이 다 작품이에요.' },
    { name: '지우', rating: 4, comment: '독일마을 카페에서 보는 바다뷰가 예뻐요.' }
  ]
};

// Preset gradients handed out to user-added destinations that skip the
// photo upload, so they still look intentional rather than blank.
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(150deg,#2a72a8,#158a94)',
  'linear-gradient(150deg,#8a4a9e,#a8517a)',
  'linear-gradient(150deg,#358a44,#5e8a2e)',
  'linear-gradient(150deg,#a8792e,#7a5230)',
  'linear-gradient(150deg,#1f6a7c,#245f92)',
  'linear-gradient(150deg,#1f9e7e,#238a9b)'
];
