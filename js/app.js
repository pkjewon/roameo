/**
 * Roameo — 여행 정보 플랫폼
 *
 * A single-page, dependency-free travel site. All state lives in the `state`
 * object below and is persisted to localStorage where noted. The UI is
 * re-rendered imperatively from small `render*` functions — each owns one
 * region of the page and reads from `state`.
 *
 * Feature map: dark mode, random pick, countdown, back-to-top, card hover,
 * search, category filter, sort, favorites, empty state, localStorage,
 * application form, like/dislike voting, favorites-only view, and combined
 * search + category filtering.
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Data
   * ------------------------------------------------------------------ */
  const CATS = ['전체', '자연', '바다', '도시', '역사', '체험'];

  // `l` / `d` are the seed like / dislike counts. A user's own vote is layered
  // on top at read time via likesOf()/dislikesOf() so it stays reversible.
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

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const state = {
    theme: 'light',
    search: '',
    category: '전체',
    sort: 'recommended',
    favOnly: false,
    favs: [],            // array of destination ids
    userVote: {},        // { [id]: 'like' | 'dislike' }
    departDate: '',
    spotlightId: null,   // id highlighted by "랜덤 여행지 추천"
    showTop: false,
    modalOpen: false,
    submitted: false,
    submittedName: '',
    form: { name: '', email: '', phone: '', people: '', depart: '', arrive: '', agree: false },
    errors: {}
  };

  let gridAnimated = false;     // run the card entrance animation only once
  let lastFocused = null;       // element to restore focus to when the modal closes

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');

  /* ------------------------------------------------------------------ *
   * localStorage helpers
   * ------------------------------------------------------------------ */
  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {}
  }

  function init() {
    // Stored preference wins; otherwise fall back to the OS colour scheme.
    const storedTheme = localStorage.getItem('roameo_theme');
    state.theme = storedTheme
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    state.favs = load('roameo_favs', []);
    state.userVote = load('roameo_uservote', {});
    state.departDate = localStorage.getItem('roameo_depart') || '';
  }

  /* ------------------------------------------------------------------ *
   * Derived values
   * ------------------------------------------------------------------ */
  function likesOf(d) { return d.l + (state.userVote[d.id] === 'like' ? 1 : 0); }
  function dislikesOf(d) { return d.d + (state.userVote[d.id] === 'dislike' ? 1 : 0); }
  function scoreOf(d) { return likesOf(d) - dislikesOf(d); }

  // Search + category + favorites-only are all applied together, then sorted.
  function getFilteredSorted() {
    const q = state.search.trim().toLowerCase();
    let list = DESTINATIONS.filter((d) => {
      if (state.category !== '전체' && d.category !== state.category) return false;
      if (state.favOnly && !state.favs.includes(d.id)) return false;
      if (q && !(
        d.name.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.desc.toLowerCase().includes(q)
      )) return false;
      return true;
    });
    if (state.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    else if (state.sort === 'likes') list = [...list].sort((a, b) => likesOf(b) - likesOf(a));
    return list;
  }

  /* ------------------------------------------------------------------ *
   * DOM references
   * ------------------------------------------------------------------ */
  const el = {
    app: document.getElementById('app'),
    navCats: document.getElementById('navCats'),
    chipCats: document.getElementById('chipCats'),
    headerSearch: document.getElementById('headerSearch'),
    heroSearch: document.getElementById('heroSearch'),
    toolbarSearch: document.getElementById('toolbarSearch'),
    heroSearchBtn: document.getElementById('heroSearchBtn'),
    themeToggle: document.getElementById('themeToggle'),
    iconMoon: document.getElementById('iconMoon'),
    iconSun: document.getElementById('iconSun'),
    randomBtn: document.getElementById('randomBtn'),
    planBtn: document.getElementById('planBtn'),
    topName: document.getElementById('topName'),
    topScore: document.getElementById('topScore'),
    destCount: document.getElementById('destCount'),
    favCount: document.getElementById('favCount'),
    resultSummary: document.getElementById('resultSummary'),
    sortSelect: document.getElementById('sortSelect'),
    favOnlyBtn: document.getElementById('favOnlyBtn'),
    emptyState: document.getElementById('emptyState'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    cardGrid: document.getElementById('cardGrid'),
    departDate: document.getElementById('departDate'),
    openModalBtn: document.getElementById('openModalBtn'),
    cdDday: document.getElementById('cdDday'),
    cdLabel: document.getElementById('cdLabel'),
    cdDays: document.getElementById('cdDays'),
    cdHours: document.getElementById('cdHours'),
    cdMins: document.getElementById('cdMins'),
    cdSecs: document.getElementById('cdSecs'),
    pollGrid: document.getElementById('pollGrid'),
    topBtn: document.getElementById('topBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalBox: document.getElementById('modalBox'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),
    modalSuccess: document.getElementById('modalSuccess'),
    modalSuccessDesc: document.getElementById('modalSuccessDesc'),
    newApplicationBtn: document.getElementById('newApplicationBtn'),
    applicationForm: document.getElementById('applicationForm'),
    fName: document.getElementById('fName'),
    fEmail: document.getElementById('fEmail'),
    fPhone: document.getElementById('fPhone'),
    fPeople: document.getElementById('fPeople'),
    fDepart: document.getElementById('fDepart'),
    fArrive: document.getElementById('fArrive'),
    fAgree: document.getElementById('fAgree')
  };

  /* ------------------------------------------------------------------ *
   * Render: theme (dark mode)
   * ------------------------------------------------------------------ */
  function renderTheme() {
    const isDark = state.theme === 'dark';
    el.app.setAttribute('data-theme', state.theme);
    el.iconMoon.style.display = isDark ? 'none' : 'block';
    el.iconSun.style.display = isDark ? 'block' : 'none';
    el.themeToggle.setAttribute('aria-pressed', String(isDark));
    el.themeToggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    el.themeToggle.title = isDark ? '라이트 모드' : '다크 모드';
  }

  /* ------------------------------------------------------------------ *
   * Render: category controls (header nav + toolbar chips)
   * ------------------------------------------------------------------ */
  function renderCategoryControls() {
    el.navCats.innerHTML = '';
    el.chipCats.innerHTML = '';
    CATS.forEach((c) => {
      const active = state.category === c;

      const navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.textContent = c;
      navBtn.setAttribute('aria-pressed', String(active));
      if (active) navBtn.classList.add('is-active');
      navBtn.addEventListener('click', () => setCategory(c));
      el.navCats.appendChild(navBtn);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (active ? ' is-active' : '');
      chip.textContent = c;
      chip.setAttribute('aria-pressed', String(active));
      chip.addEventListener('click', () => setCategory(c));
      el.chipCats.appendChild(chip);
    });
  }

  function setCategory(c) {
    state.category = c;
    state.spotlightId = null;
    renderCategoryControls();
    renderGrid();
    renderHeroStats();
  }

  /* ------------------------------------------------------------------ *
   * Render: search inputs (header / hero / toolbar stay in sync)
   * ------------------------------------------------------------------ */
  function syncSearchInputs() {
    [el.headerSearch, el.heroSearch, el.toolbarSearch].forEach((input) => {
      if (input.value !== state.search) input.value = state.search;
    });
  }
  function onSearchInput(e) {
    state.search = e.target.value;
    syncSearchInputs();
    renderGrid();
  }

  /* ------------------------------------------------------------------ *
   * Render: hero stat cards
   * ------------------------------------------------------------------ */
  function renderHeroStats() {
    const top = [...DESTINATIONS].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
    el.topName.textContent = top.name;
    el.topScore.textContent = '추천 점수 ' + scoreOf(top);
    el.destCount.textContent = DESTINATIONS.length + '곳';
    el.favCount.textContent = state.favs.length + '개';
  }

  /* ------------------------------------------------------------------ *
   * Render: toolbar state (sort value + favorites-only pressed state)
   * ------------------------------------------------------------------ */
  function renderToolbarState() {
    el.sortSelect.value = state.sort;
    el.favOnlyBtn.classList.toggle('is-active', state.favOnly);
    el.favOnlyBtn.setAttribute('aria-pressed', String(state.favOnly));
  }

  /* ------------------------------------------------------------------ *
   * Render: destination card grid (+ empty state)
   * ------------------------------------------------------------------ */
  function renderGrid() {
    const list = getFilteredSorted();
    el.resultSummary.textContent = list.length + '개의 여행지 · 마음에 드는 곳을 찜해보세요';

    el.emptyState.hidden = list.length !== 0;
    el.cardGrid.hidden = list.length === 0;
    el.cardGrid.innerHTML = '';

    list.forEach((d, i) => {
      const isFav = state.favs.includes(d.id);
      const isSpotlight = state.spotlightId === d.id;

      const card = document.createElement('article');
      card.className = 'card' + (isSpotlight ? ' is-spotlight' : '');
      // Stagger a gentle entrance on the very first paint only.
      if (!gridAnimated) {
        card.classList.add('card--enter');
        card.style.animationDelay = Math.min(i * 45, 400) + 'ms';
      }

      card.innerHTML = `
        <div class="card__image-wrap">
          <div class="card__image" style="background:${d.grad}"></div>
          <div class="card__image-shade"></div>
          <span class="card__badge">${d.category}</span>
          <button class="card__fav${isFav ? ' is-fav' : ''}" type="button"
                  aria-pressed="${isFav}" aria-label="${d.name} ${isFav ? '찜 해제' : '찜하기'}">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-9.3-9C1.2 8 2.5 5 5.5 5 7.5 5 9 6.3 12 9c3-2.7 4.5-4 6.5-4 3 0 4.3 3 2.8 6-2.3 4.5-9.3 9-9.3 9Z"/></svg>
          </button>
          ${isSpotlight ? '<span class="card__spotlight-tag">오늘의 추천</span>' : ''}
        </div>
        <div class="card__body">
          <div class="card__title-row">
            <h3 class="card__title">${d.name}</h3>
            <span class="card__region">${d.region}</span>
          </div>
          <p class="card__desc">${d.desc}</p>
          <div class="card__meta">
            <span class="likes">▲ ${likesOf(d)}</span>
            <span>▼ ${dislikesOf(d)}</span>
            <span class="more">자세히
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </span>
          </div>
        </div>
      `;

      card.querySelector('.card__fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(d.id);
      });

      el.cardGrid.appendChild(card);
    });

    gridAnimated = true;
  }

  function toggleFav(id) {
    state.favs = state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id];
    save('roameo_favs', state.favs);
    renderGrid();
    renderHeroStats();
  }

  function resetFilters() {
    state.search = '';
    state.category = '전체';
    state.favOnly = false;
    state.spotlightId = null;
    syncSearchInputs();
    renderCategoryControls();
    renderToolbarState();
    renderGrid();
  }

  /* ------------------------------------------------------------------ *
   * Render: countdown (updates value nodes only — no per-tick reflow churn)
   * ------------------------------------------------------------------ */
  function renderCountdown() {
    let dday = 'D-?';
    let label = '출발일을 선택하세요';
    let days = '00', hours = '00', mins = '00', secs = '00';

    if (state.departDate) {
      const target = new Date(state.departDate + 'T00:00:00').getTime();
      const diff = target - Date.now();
      if (diff <= 0 && diff > -86400000) {
        dday = 'D-DAY'; label = '드디어 출발일이에요!';
      } else if (diff <= 0) {
        dday = '완료'; label = '여행이 지났어요';
      } else {
        const p = (n) => String(n).padStart(2, '0');
        days = p(Math.floor(diff / 86400000));
        hours = p(Math.floor((diff % 86400000) / 3600000));
        mins = p(Math.floor((diff % 3600000) / 60000));
        secs = p(Math.floor((diff % 60000) / 1000));
        dday = 'D-' + Number(days);
        label = '출발까지 남은 시간';
      }
    }

    el.cdDday.textContent = dday;
    el.cdLabel.textContent = label;
    el.cdDays.textContent = days;
    el.cdHours.textContent = hours;
    el.cdMins.textContent = mins;
    el.cdSecs.textContent = secs;
  }

  /* ------------------------------------------------------------------ *
   * Render: voting leaderboard (ranked by net score = 좋아요 − 싫어요)
   * ------------------------------------------------------------------ */
  function rankClass(rank) {
    if (rank === 1) return ' poll-card__rank--1';
    if (rank === 2) return ' poll-card__rank--2';
    if (rank === 3) return ' poll-card__rank--3';
    return '';
  }

  function renderPoll() {
    const ranked = [...DESTINATIONS].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 6);
    const maxScore = ranked.length ? Math.max(1, scoreOf(ranked[0])) : 1;

    el.pollGrid.innerHTML = ranked.map((d, i) => {
      const rank = i + 1;
      const lk = likesOf(d), dk = dislikesOf(d), score = lk - dk;
      const uv = state.userVote[d.id];
      const width = Math.max(4, Math.round(score / maxScore * 100)) + '%';
      return `
        <div class="poll-card" data-id="${d.id}">
          <div class="poll-card__top">
            <span class="poll-card__rank${rankClass(rank)}">${rank}</span>
            <div class="poll-card__info">
              <div class="poll-card__name">${d.name}</div>
              <div class="poll-card__region">${d.region}</div>
            </div>
            <div class="poll-card__score-wrap">
              <div class="poll-card__score">${score}</div>
              <div class="poll-card__score-label">추천 점수</div>
            </div>
          </div>
          <div class="poll-card__counts">
            <span class="like-count">좋아요 ${lk}</span>
            <span>싫어요 ${dk}</span>
          </div>
          <div class="poll-card__bar-track">
            <div class="poll-card__bar-fill" style="width:${width}"></div>
          </div>
          <div class="poll-card__actions">
            <button class="poll-btn like${uv === 'like' ? ' is-active' : ''}" type="button" data-dir="like" aria-pressed="${uv === 'like'}" aria-label="${d.name} 좋아요">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v10M7 10l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/></svg>
              좋아요 ${lk}
            </button>
            <button class="poll-btn dislike${uv === 'dislike' ? ' is-active' : ''}" type="button" data-dir="dislike" aria-pressed="${uv === 'dislike'}" aria-label="${d.name} 싫어요">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V4M17 14l-4 7a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17"/></svg>
              싫어요 ${dk}
            </button>
          </div>
        </div>
      `;
    }).join('');

    el.pollGrid.querySelectorAll('.poll-card').forEach((card) => {
      const id = card.getAttribute('data-id');
      card.querySelectorAll('.poll-btn').forEach((btn) => {
        btn.addEventListener('click', () => vote(id, btn.getAttribute('data-dir')));
      });
    });
  }

  // A like/dislike is a toggle: clicking the active direction clears the vote.
  function vote(id, dir) {
    const uv = { ...state.userVote };
    if (uv[id] === dir) delete uv[id]; else uv[id] = dir;
    state.userVote = uv;
    save('roameo_uservote', uv);
    renderGrid();
    renderPoll();
    renderHeroStats();
  }

  /* ------------------------------------------------------------------ *
   * Random pick — spotlight a destination and scroll to the grid
   * ------------------------------------------------------------------ */
  function onRandom() {
    const d = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
    state.spotlightId = d.id;
    state.category = '전체';
    state.search = '';
    state.favOnly = false;
    syncSearchInputs();
    renderCategoryControls();
    renderToolbarState();
    renderGrid();
    setTimeout(scrollToGrid, 60);
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) window.scrollTo({ top: target.offsetTop - 74, behavior: scrollBehavior() });
  }
  const scrollToGrid = () => scrollToSection('grid');
  const scrollToPlan = () => scrollToSection('plan');
  const scrollTop = () => window.scrollTo({ top: 0, behavior: scrollBehavior() });

  /* ------------------------------------------------------------------ *
   * Application modal + form
   * ------------------------------------------------------------------ */
  function openModal() {
    lastFocused = document.activeElement;
    state.modalOpen = true;
    state.submitted = false;
    if (!state.form.depart) state.form.depart = state.departDate;
    renderModal();
    // Move focus into the dialog once it is visible.
    requestAnimationFrame(() => {
      (state.submitted ? el.modalConfirmBtn : el.fName).focus();
    });
  }

  function closeModal() {
    state.modalOpen = false;
    renderModal();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function newApplication() {
    state.submitted = false;
    state.errors = {};
    state.form = { name: '', email: '', phone: '', people: '', depart: '', arrive: '', agree: false };
    renderModal();
    requestAnimationFrame(() => el.fName.focus());
  }

  function renderModal() {
    el.modalOverlay.hidden = !state.modalOpen;
    // Lock background scroll while the dialog is open.
    document.body.style.overflow = state.modalOpen ? 'hidden' : '';
    if (!state.modalOpen) return;

    el.modalSuccess.hidden = !state.submitted;
    el.applicationForm.hidden = state.submitted;
    if (state.submitted) {
      el.modalSuccessDesc.innerHTML =
        `${state.submittedName}님, 입력하신 이메일로<br>여행 상세 안내를 보내드릴게요.`;
      return;
    }

    // Reflect form values.
    el.fName.value = state.form.name;
    el.fEmail.value = state.form.email;
    el.fPhone.value = state.form.phone;
    el.fPeople.value = state.form.people;
    el.fDepart.value = state.form.depart;
    el.fArrive.value = state.form.arrive;
    el.fAgree.checked = state.form.agree;

    // Reflect validation errors (border, message, aria-invalid).
    ['name', 'email', 'phone', 'people', 'depart', 'arrive'].forEach((k) => {
      const input = el['f' + k[0].toUpperCase() + k.slice(1)];
      const errorEl = document.getElementById('f' + k[0].toUpperCase() + k.slice(1) + 'Error');
      const hasError = !!state.errors[k];
      input.classList.toggle('has-error', hasError);
      input.setAttribute('aria-invalid', String(hasError));
      errorEl.textContent = hasError ? state.errors[k] : '';
      errorEl.hidden = !hasError;
    });

    const agreeError = document.getElementById('fAgreeError');
    const agreeLabel = el.fAgree.nextElementSibling; // the .checkbox-row label
    agreeLabel.classList.toggle('has-error', !!state.errors.agree);
    agreeError.textContent = state.errors.agree || '';
    agreeError.hidden = !state.errors.agree;
  }

  function setFormField(key) {
    return (e) => { state.form[key] = e.target.value; };
  }

  function submitForm(e) {
    e.preventDefault();
    const f = state.form;
    const er = {};
    if (!f.name.trim()) er.name = '이름을 입력해주세요.';
    if (!f.email.trim()) er.email = '이메일을 입력해주세요.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) er.email = '올바른 이메일 형식이 아닙니다.';
    if (!f.phone.trim()) er.phone = '전화번호를 입력해주세요.';
    else if (!/^[0-9\-+\s]{9,}$/.test(f.phone)) er.phone = '올바른 전화번호를 입력해주세요.';
    if (!f.people || Number(f.people) < 1) er.people = '여행 인원은 1명 이상이어야 합니다.';
    if (!f.depart) er.depart = '출발일을 선택해주세요.';
    if (!f.arrive) er.arrive = '도착일을 선택해주세요.';
    else if (f.depart && f.arrive < f.depart) er.arrive = '도착일은 출발일 이후여야 합니다.';
    if (!f.agree) er.agree = '개인정보 수집에 동의해주세요.';

    state.errors = er;
    if (Object.keys(er).length) {
      renderModal();
      // Move focus to the first field with an error for quick correction.
      const order = ['name', 'email', 'phone', 'people', 'depart', 'arrive'];
      const firstBad = order.find((k) => er[k]);
      if (firstBad) el['f' + firstBad[0].toUpperCase() + firstBad.slice(1)].focus();
      else if (er.agree) el.fAgree.focus();
      return;
    }

    state.submitted = true;
    state.submittedName = f.name.trim();
    state.errors = {};
    renderModal();
    requestAnimationFrame(() => el.modalConfirmBtn.focus());
  }

  // Keep Tab focus inside the dialog and close it on Escape.
  function focusableInModal() {
    return Array.from(el.modalBox.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter((n) => !n.disabled && n.offsetParent !== null);
  }
  function onModalKeydown(e) {
    if (!state.modalOpen) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const items = focusableInModal();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function bindEvents() {
    // Dark mode
    el.themeToggle.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      save('roameo_theme', state.theme);
      renderTheme();
    });

    // Search (three inputs kept in sync)
    [el.headerSearch, el.heroSearch, el.toolbarSearch].forEach((input) => {
      input.addEventListener('input', onSearchInput);
    });
    el.heroSearchBtn.addEventListener('click', scrollToGrid);

    // Hero actions
    el.randomBtn.addEventListener('click', onRandom);
    el.planBtn.addEventListener('click', scrollToPlan);

    // Sort + favorites-only
    el.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
    el.favOnlyBtn.addEventListener('click', () => {
      state.favOnly = !state.favOnly;
      renderToolbarState();
      renderGrid();
    });
    el.resetFiltersBtn.addEventListener('click', resetFilters);

    // Countdown date + open modal
    el.departDate.addEventListener('input', (e) => {
      state.departDate = e.target.value;
      save('roameo_depart', state.departDate);
      renderCountdown();
    });
    el.openModalBtn.addEventListener('click', openModal);

    // Back-to-top
    window.addEventListener('scroll', () => {
      const shouldShow = (window.scrollY || document.documentElement.scrollTop) > 500;
      if (shouldShow !== state.showTop) {
        state.showTop = shouldShow;
        el.topBtn.hidden = !shouldShow;
      }
    }, { passive: true });
    el.topBtn.addEventListener('click', scrollTop);

    // Modal open/close + focus trap
    el.modalOverlay.addEventListener('click', closeModal);
    el.modalBox.addEventListener('click', (e) => e.stopPropagation());
    el.modalCloseBtn.addEventListener('click', closeModal);
    el.modalConfirmBtn.addEventListener('click', closeModal);
    el.newApplicationBtn.addEventListener('click', newApplication);
    document.addEventListener('keydown', onModalKeydown);

    // Form fields
    el.fName.addEventListener('input', setFormField('name'));
    el.fEmail.addEventListener('input', setFormField('email'));
    el.fPhone.addEventListener('input', setFormField('phone'));
    el.fPeople.addEventListener('input', setFormField('people'));
    el.fDepart.addEventListener('input', setFormField('depart'));
    el.fArrive.addEventListener('input', setFormField('arrive'));
    el.fAgree.addEventListener('change', (e) => { state.form.agree = e.target.checked; });
    el.applicationForm.addEventListener('submit', submitForm);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function renderAll() {
    renderTheme();
    renderCategoryControls();
    syncSearchInputs();
    renderHeroStats();
    renderToolbarState();
    renderGrid();
    el.departDate.value = state.departDate;
    renderCountdown();
    renderPoll();
  }

  init();
  bindEvents();
  renderAll();
  setInterval(renderCountdown, 1000);
})();
