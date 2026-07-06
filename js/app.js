/**
 * Roameo — 여행 정보 플랫폼
 *
 * A single-page, dependency-free travel site. All state lives in the `state`
 * object below and is persisted to localStorage where noted. The UI is
 * re-rendered imperatively from small `render*` functions — each owns one
 * region of the page and reads from `state`.
 *
 * Depends on js/data.js being loaded first (defines CATS, DESTINATIONS,
 * SEED_REVIEWS, PLACEHOLDER_GRADIENTS).
 *
 * Feature map: dark mode, random pick, countdown, back-to-top, card hover,
 * search, category filter, sort, favorites, empty state, localStorage,
 * application form, like/dislike voting, favorites-only view, combined
 * search + category filtering, adding a destination (with photo upload),
 * and a detail view with user-submitted reviews.
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const state = {
    theme: 'light',
    search: '',
    category: '전체',
    sort: 'recommended',
    favOnly: false,
    favs: [],                // array of destination ids
    userVote: {},             // { [id]: 'like' | 'dislike' }
    departDate: '',
    spotlightId: null,        // id highlighted by "랜덤 여행지 추천"
    showTop: false,

    customDestinations: [],   // user-added destinations, persisted
    reviews: {},              // { [destId]: [{ name, rating, comment }] } user-added reviews, persisted
    photoOverrides: {},       // { [destId]: dataUrl } photos added to ANY card (incl. the 12 seeds), persisted
    detailId: null,           // destination currently open in the detail modal

    submitted: false,
    submittedName: '',
    form: { name: '', email: '', phone: '', people: '', depart: '', arrive: '', agree: false },
    errors: {},

    destForm: { name: '', region: '', category: '', desc: '', photoDataUrl: '' },
    destErrors: {},

    reviewForm: { name: '', rating: 0, comment: '' },
    reviewErrors: {}
  };

  let gridAnimated = false;     // run the card entrance animation only once

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
  // Returns false on quota-exceeded (e.g. a large uploaded photo) so callers
  // can warn the user instead of silently losing their submission.
  function save(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  function init() {
    // Stored preference wins; otherwise fall back to the OS colour scheme.
    const storedTheme = localStorage.getItem('roameo_theme');
    state.theme = storedTheme
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    state.favs = load('roameo_favs', []);
    state.userVote = load('roameo_uservote', {});
    state.departDate = localStorage.getItem('roameo_depart') || '';
    state.customDestinations = load('roameo_customDestinations', []);
    state.reviews = load('roameo_reviews', {});
    state.photoOverrides = load('roameo_photoOverrides', {});
  }

  /* ------------------------------------------------------------------ *
   * Text safety — user-typed strings (destination name/region/desc, review
   * name/comment) get rendered via innerHTML templates, so escape them.
   * ------------------------------------------------------------------ */
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  }

  /* ------------------------------------------------------------------ *
   * Derived values
   * ------------------------------------------------------------------ */
  // Seed destinations + anything the user has added, combined.
  function destinationsList() { return DESTINATIONS.concat(state.customDestinations); }
  function findDestination(id) { return destinationsList().find((d) => d.id === id); }

  function likesOf(d) { return d.l + (state.userVote[d.id] === 'like' ? 1 : 0); }
  function dislikesOf(d) { return d.d + (state.userVote[d.id] === 'dislike' ? 1 : 0); }
  function scoreOf(d) { return likesOf(d) - dislikesOf(d); }

  // The photo shown for a destination: a user-added override wins, then a
  // custom destination's own uploaded photo, else null (→ gradient fallback).
  // Works uniformly for the 12 built-in cards and user-added ones.
  function photoOf(d) { return state.photoOverrides[d.id] || d.photo || null; }

  // Built-in destinations ship with SEED_REVIEWS; anything a user submits is
  // appended after those. Custom destinations simply have no seed reviews.
  function getReviewsFor(id) {
    return (SEED_REVIEWS[id] || []).concat(state.reviews[id] || []);
  }

  // Search + category + favorites-only are all applied together, then sorted.
  function getFilteredSorted() {
    const q = state.search.trim().toLowerCase();
    let list = destinationsList().filter((d) => {
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
    logoLink: document.getElementById('logoLink'),
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
    headerTrip: document.getElementById('headerTrip'),
    headerTripText: document.getElementById('headerTripText'),
    tripHeroDday: document.getElementById('tripHeroDday'),
    tripHeroSub: document.getElementById('tripHeroSub'),
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

    // Application modal
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
    fAgree: document.getElementById('fAgree'),

    // Add-destination modal
    addDestBtn: document.getElementById('addDestBtn'),
    addDestOverlay: document.getElementById('addDestOverlay'),
    addDestBox: document.getElementById('addDestBox'),
    addDestCloseBtn: document.getElementById('addDestCloseBtn'),
    addDestForm: document.getElementById('addDestForm'),
    fDestName: document.getElementById('fDestName'),
    fDestRegion: document.getElementById('fDestRegion'),
    fDestCategory: document.getElementById('fDestCategory'),
    fDestDesc: document.getElementById('fDestDesc'),
    fDestPhoto: document.getElementById('fDestPhoto'),
    destPhotoPreviewWrap: document.getElementById('destPhotoPreviewWrap'),
    destPhotoPreview: document.getElementById('destPhotoPreview'),
    destPhotoRemoveBtn: document.getElementById('destPhotoRemoveBtn'),

    // Detail modal
    detailOverlay: document.getElementById('detailOverlay'),
    detailBox: document.getElementById('detailBox'),
    detailCloseBtn: document.getElementById('detailCloseBtn'),
    detailBanner: document.getElementById('detailBanner'),
    detailBadge: document.getElementById('detailBadge'),
    detailPhotoInput: document.getElementById('detailPhotoInput'),
    detailPhotoBtnText: document.getElementById('detailPhotoBtnText'),
    detailPhotoRemoveBtn: document.getElementById('detailPhotoRemoveBtn'),
    detailName: document.getElementById('detailName'),
    detailRegion: document.getElementById('detailRegion'),
    detailDesc: document.getElementById('detailDesc'),
    detailLikes: document.getElementById('detailLikes'),
    detailDislikes: document.getElementById('detailDislikes'),
    detailRatingStars: document.getElementById('detailRatingStars'),
    detailRatingAvg: document.getElementById('detailRatingAvg'),
    detailReviewCount: document.getElementById('detailReviewCount'),
    detailReviews: document.getElementById('detailReviews'),
    reviewForm: document.getElementById('reviewForm'),
    reviewStarPicker: document.getElementById('reviewStarPicker'),
    fReviewName: document.getElementById('fReviewName'),
    fReviewComment: document.getElementById('fReviewComment'),

    // Random pick modal
    randomOverlay: document.getElementById('randomOverlay'),
    randomBox: document.getElementById('randomBox'),
    randomCloseBtn: document.getElementById('randomCloseBtn'),
    reelStrip: document.getElementById('reelStrip'),
    randomResult: document.getElementById('randomResult'),
    randomResultName: document.getElementById('randomResultName'),
    randomResultRegion: document.getElementById('randomResultRegion'),
    randomDetailBtn: document.getElementById('randomDetailBtn'),
    randomAgainBtn: document.getElementById('randomAgainBtn')
  };

  /* ------------------------------------------------------------------ *
   * Generic modal plumbing — shared by the application, add-destination,
   * and detail dialogs so focus-trap / Escape / scroll-lock isn't
   * duplicated three times.
   * ------------------------------------------------------------------ */
  let openOverlay = null;
  let returnFocusTo = null;

  function focusableIn(container) {
    return Array.from(container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter((n) => !n.disabled && n.offsetParent !== null);
  }

  function openDialog(overlay, initialFocusEl) {
    returnFocusTo = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    openOverlay = overlay;
    requestAnimationFrame(() => initialFocusEl && initialFocusEl.focus());
  }

  function closeDialog(overlay) {
    overlay.hidden = true;
    openOverlay = null;
    // Only unlock scroll if no other dialog is underneath it.
    document.body.style.overflow = '';
    if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
  }

  function onGlobalKeydown(e) {
    if (!openOverlay) return;
    if (e.key === 'Escape') { closeDialog(openOverlay); return; }
    if (e.key !== 'Tab') return;
    const box = openOverlay.querySelector('[role="dialog"]') || openOverlay.firstElementChild;
    const items = focusableIn(box);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

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
    renderMode();
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
    // Searching always looks across ALL destinations, so drop any active
    // category back to "전체".
    if (state.category !== '전체') {
      state.category = '전체';
      state.spotlightId = null;
      renderCategoryControls();
    }
    syncSearchInputs();
    renderGrid();
    renderMode();
  }

  /* ------------------------------------------------------------------ *
   * Render: hero stat cards
   * ------------------------------------------------------------------ */
  function renderHeroStats() {
    const all = destinationsList();
    const top = [...all].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
    el.topName.textContent = top.name;
    el.topScore.textContent = '추천 점수 ' + scoreOf(top);
    el.destCount.textContent = all.length + '곳';
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
      const name = escapeHtml(d.name), region = escapeHtml(d.region), desc = escapeHtml(d.desc);
      // Uploaded photo wins over the placeholder gradient when present.
      const photo = photoOf(d);
      const imageStyle = photo ? `background:center/cover no-repeat url(${photo})` : `background:${d.grad}`;

      const card = document.createElement('article');
      card.className = 'card' + (isSpotlight ? ' is-spotlight' : '');
      // The whole card opens the detail view (keyboard-accessible too).
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', d.name + ' 상세 보기');
      // Stagger a gentle entrance on the very first paint only.
      if (!gridAnimated) {
        card.classList.add('card--enter');
        card.style.animationDelay = Math.min(i * 45, 400) + 'ms';
      }

      card.innerHTML = `
        <div class="card__image-wrap">
          <div class="card__image" style="${imageStyle}"></div>
          <div class="card__image-shade"></div>
          <span class="card__badge">${escapeHtml(d.category)}</span>
          <button class="card__fav${isFav ? ' is-fav' : ''}" type="button"
                  aria-pressed="${isFav}" aria-label="${name} ${isFav ? '찜 해제' : '찜하기'}">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-9.3-9C1.2 8 2.5 5 5.5 5 7.5 5 9 6.3 12 9c3-2.7 4.5-4 6.5-4 3 0 4.3 3 2.8 6-2.3 4.5-9.3 9-9.3 9Z"/></svg>
          </button>
          ${isSpotlight ? '<span class="card__spotlight-tag">오늘의 추천</span>' : ''}
        </div>
        <div class="card__body">
          <div class="card__title-row">
            <h3 class="card__title">${name}</h3>
            <span class="card__region">${region}</span>
          </div>
          <p class="card__desc">${desc}</p>
          <div class="card__meta">
            <span class="likes">▲ ${likesOf(d)}</span>
            <span>▼ ${dislikesOf(d)}</span>
            <button type="button" class="card__detail-btn">자세히
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>
        </div>
      `;

      // Clicking anywhere on the card opens the detail view…
      card.addEventListener('click', () => openDetail(d.id));
      // …and Enter / Space do the same for keyboard users.
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(d.id); }
      });
      // The ♥ button toggles favourite without opening the detail view.
      card.querySelector('.card__fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(d.id);
      });
      // The "자세히" button already opens it; stop it from double-firing.
      card.querySelector('.card__detail-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openDetail(d.id);
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
    renderMode();
  }

  // Logo click → clear all filters and return to the top of the home view.
  function goHome() {
    resetFilters();
    scrollTop();
  }

  /* ------------------------------------------------------------------ *
   * Render: countdown (updates value nodes only — no per-tick reflow churn)
   * ------------------------------------------------------------------ */
  function renderCountdown() {
    let dday = 'D-?';
    let label = '출발일을 선택하세요';
    let days = '00', hours = '00', mins = '00', secs = '00';
    let tripSub = '출발일을 선택하세요';   // hero widget sub-line
    let headerText = '출발 미정';           // header pill text

    if (state.departDate) {
      const target = new Date(state.departDate + 'T00:00:00').getTime();
      const diff = target - Date.now();
      if (diff <= 0 && diff > -86400000) {
        dday = 'D-DAY'; label = '드디어 출발일이에요!';
        tripSub = '오늘 출발!'; headerText = 'D-DAY';
      } else if (diff <= 0) {
        dday = '완료'; label = '여행이 지났어요';
        tripSub = '여행이 지났어요'; headerText = '완료';
      } else {
        const p = (n) => String(n).padStart(2, '0');
        const nDays = Math.floor(diff / 86400000);
        const nHours = Math.floor((diff % 86400000) / 3600000);
        days = p(nDays); hours = p(nHours);
        mins = p(Math.floor((diff % 3600000) / 60000));
        secs = p(Math.floor((diff % 60000) / 1000));
        dday = 'D-' + nDays;
        label = '출발까지 남은 시간';
        tripSub = `${nDays}일 ${nHours}시간 남았어요`;
        headerText = `${dday} · ${nDays}일 ${nHours}시간`;
      }
    }

    // Countdown section (plan card)
    el.cdDday.textContent = dday;
    el.cdLabel.textContent = label;
    el.cdDays.textContent = days;
    el.cdHours.textContent = hours;
    el.cdMins.textContent = mins;
    el.cdSecs.textContent = secs;

    // Hero widget + header pill share the same countdown
    el.tripHeroDday.textContent = dday;
    el.tripHeroSub.textContent = tripSub;
    el.headerTripText.textContent = headerText;
    el.headerTrip.title = state.departDate ? `${dday} · ${tripSub}` : '출발일을 선택하세요';
  }

  /* ------------------------------------------------------------------ *
   * Home vs. filtering view — a search / non-"전체" category / favorites-only
   * filter switches to a list-only layout (hero, plan, poll hidden) and moves
   * the trip countdown into the header.
   * ------------------------------------------------------------------ */
  function isFiltering() {
    return state.search.trim() !== '' || state.category !== '전체' || state.favOnly;
  }
  function renderMode() {
    const filtering = isFiltering();
    el.app.classList.toggle('is-filtering', filtering);
    el.headerTrip.hidden = !filtering;
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
    const ranked = [...destinationsList()].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 6);
    const maxScore = ranked.length ? Math.max(1, scoreOf(ranked[0])) : 1;

    el.pollGrid.innerHTML = ranked.map((d, i) => {
      const rank = i + 1;
      const lk = likesOf(d), dk = dislikesOf(d), score = lk - dk;
      const uv = state.userVote[d.id];
      const width = Math.max(4, Math.round(score / maxScore * 100)) + '%';
      const name = escapeHtml(d.name), region = escapeHtml(d.region);
      return `
        <div class="poll-card" data-id="${d.id}">
          <div class="poll-card__top">
            <span class="poll-card__rank${rankClass(rank)}">${rank}</span>
            <div class="poll-card__info">
              <div class="poll-card__name">${name}</div>
              <div class="poll-card__region">${region}</div>
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
            <button class="poll-btn like${uv === 'like' ? ' is-active' : ''}" type="button" data-dir="like" aria-pressed="${uv === 'like'}" aria-label="${name} 좋아요">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v10M7 10l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/></svg>
              좋아요 ${lk}
            </button>
            <button class="poll-btn dislike${uv === 'dislike' ? ' is-active' : ''}" type="button" data-dir="dislike" aria-pressed="${uv === 'dislike'}" aria-label="${name} 싫어요">
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
   * Random pick — slot-machine reel inside a blurred popup.
   * Cards stream downward fast, ease-out to a stop, and one is chosen.
   * ------------------------------------------------------------------ */
  const REEL_H = 116;          // item height (104) + gap (12) — MUST match CSS
  const REEL_LEAD = 2;         // rows above the winner (winner lands in row index 2 → middle)
  const REEL_TRAILING = 34;    // rows spun through before the winner settles
  const REEL_DURATION = 3200;  // ms of spin
  let reelWinnerId = null;
  let reelRaf = null;          // pending requestAnimationFrame id, for cleanup

  // easeOutQuart — fast start, long smooth deceleration (the "촤라락 → 스르륵 정지" feel)
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  const randDest = (all) => all[Math.floor(Math.random() * all.length)];

  function reelItemHtml(d) {
    const photo = photoOf(d);
    const bg = photo ? `background-image:url(${photo})` : `background:${d.grad}`;
    return `
      <div class="reel-item">
        <div class="reel-item__thumb" style="${bg}"></div>
        <div>
          <div class="reel-item__name">${escapeHtml(d.name)}</div>
          <div class="reel-item__region">${escapeHtml(d.region)} · ${escapeHtml(d.category)}</div>
        </div>
      </div>`;
  }

  function onRandom() {
    state.category = '전체';
    state.search = '';
    state.favOnly = false;
    syncSearchInputs();
    renderCategoryControls();
    renderToolbarState();
    renderGrid();
    renderMode();

    openDialog(el.randomOverlay, el.randomCloseBtn);
    spinReel();
  }

  function spinReel() {
    const all = destinationsList();
    const winner = randDest(all);
    reelWinnerId = winner.id;

    // Strip: [lead fillers, WINNER, trailing fillers]. The winner sits at
    // index REEL_LEAD; trailing fillers give the reel room to spin through.
    const items = [];
    for (let i = 0; i < REEL_LEAD; i++) items.push(randDest(all));
    items.push(winner);
    for (let i = 0; i < REEL_TRAILING; i++) items.push(randDest(all));
    el.reelStrip.innerHTML = items.map(reelItemHtml).join('');
    el.randomResult.hidden = true;

    // Offset that centers the winner in the middle highlight row.
    const finalOffset = -(REEL_LEAD - 1) * REEL_H;
    // Start deep in the trailing fillers, then scroll DOWN to the winner.
    const startOffset = finalOffset - REEL_TRAILING * REEL_H;

    if (reelRaf) { cancelAnimationFrame(reelRaf); reelRaf = null; }
    el.reelStrip.style.transition = 'none';

    if (prefersReducedMotion()) {
      el.reelStrip.style.transform = `translateY(${finalOffset}px)`;
      landReel();
      return;
    }

    // Hand-rolled rAF tween so the easing curve is exactly easeOutQuart.
    const distance = finalOffset - startOffset;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / REEL_DURATION);
      const offset = startOffset + distance * easeOutQuart(t);
      el.reelStrip.style.transform = `translateY(${offset}px)`;
      if (t < 1) {
        reelRaf = requestAnimationFrame(step);
      } else {
        reelRaf = null;
        landReel();
      }
    };
    el.reelStrip.style.transform = `translateY(${startOffset}px)`;
    reelRaf = requestAnimationFrame(step);
  }

  function landReel() {
    const winner = findDestination(reelWinnerId);
    if (!winner) return;
    // Emphasise the winning row (the winner is the child at index REEL_LEAD).
    const winRow = el.reelStrip.children[REEL_LEAD];
    if (winRow) winRow.classList.add('reel-item--win');

    el.randomResultName.textContent = winner.name;
    el.randomResultRegion.textContent = `${winner.region} · ${winner.category}`;
    el.randomResult.hidden = false;
    requestAnimationFrame(() => el.randomDetailBtn.focus());

    // Also spotlight it in the grid underneath, so it's easy to find on close.
    state.spotlightId = winner.id;
    renderGrid();
  }

  function closeRandomModal() {
    if (reelRaf) { cancelAnimationFrame(reelRaf); reelRaf = null; }
    closeDialog(el.randomOverlay);
  }
  function randomAgain() { spinReel(); }
  function randomOpenDetail() {
    const id = reelWinnerId;
    closeRandomModal();
    if (id) openDetail(id);
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) window.scrollTo({ top: target.offsetTop - 74, behavior: scrollBehavior() });
  }
  const scrollToGrid = () => scrollToSection('grid');
  const scrollToPlan = () => scrollToSection('plan');
  const scrollTop = () => window.scrollTo({ top: 0, behavior: scrollBehavior() });

  /* ------------------------------------------------------------------ *
   * Application modal + form (여행 신청)
   * ------------------------------------------------------------------ */
  function openModal() {
    state.submitted = false;
    if (!state.form.depart) state.form.depart = state.departDate;
    renderModal();
    openDialog(el.modalOverlay, state.submitted ? el.modalConfirmBtn : el.fName);
  }

  function closeModal() {
    closeDialog(el.modalOverlay);
  }

  function newApplication() {
    state.submitted = false;
    state.errors = {};
    state.form = { name: '', email: '', phone: '', people: '', depart: '', arrive: '', agree: false };
    renderModal();
    requestAnimationFrame(() => el.fName.focus());
  }

  function renderModal() {
    el.modalSuccess.hidden = !state.submitted;
    el.applicationForm.hidden = state.submitted;
    if (state.submitted) {
      el.modalSuccessDesc.innerHTML =
        `${escapeHtml(state.submittedName)}님, 입력하신 이메일로<br>여행 상세 안내를 보내드릴게요.`;
      return;
    }

    el.fName.value = state.form.name;
    el.fEmail.value = state.form.email;
    el.fPhone.value = state.form.phone;
    el.fPeople.value = state.form.people;
    el.fDepart.value = state.form.depart;
    el.fArrive.value = state.form.arrive;
    el.fAgree.checked = state.form.agree;

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

  /* ------------------------------------------------------------------ *
   * Add-destination modal + form (여행지 추가)
   * ------------------------------------------------------------------ */
  function populateDestCategorySelect() {
    el.fDestCategory.innerHTML = CATS.filter((c) => c !== '전체')
      .map((c) => `<option value="${c}">${c}</option>`)
      .join('');
  }

  function resetDestForm() {
    state.destForm = { name: '', region: '', category: el.fDestCategory.options[0]?.value || '', desc: '', photoDataUrl: '' };
    state.destErrors = {};
    el.fDestName.value = '';
    el.fDestRegion.value = '';
    el.fDestCategory.value = state.destForm.category;
    el.fDestDesc.value = '';
    el.fDestPhoto.value = '';
    el.destPhotoPreviewWrap.hidden = true;
    renderDestFormErrors();
  }

  function openAddDestModal() {
    resetDestForm();
    openDialog(el.addDestOverlay, el.fDestName);
  }
  function closeAddDestModal() { closeDialog(el.addDestOverlay); }

  function renderDestFormErrors() {
    const fields = {
      name: [el.fDestName, 'fDestNameError'],
      region: [el.fDestRegion, 'fDestRegionError'],
      category: [el.fDestCategory, 'fDestCategoryError'],
      desc: [el.fDestDesc, 'fDestDescError']
    };
    Object.entries(fields).forEach(([key, [input, errId]]) => {
      const hasError = !!state.destErrors[key];
      const errorEl = document.getElementById(errId);
      input.classList.toggle('has-error', hasError);
      input.setAttribute('aria-invalid', String(hasError));
      errorEl.textContent = hasError ? state.destErrors[key] : '';
      errorEl.hidden = !hasError;
    });
    const photoErr = document.getElementById('fDestPhotoError');
    photoErr.textContent = state.destErrors.photo || '';
    photoErr.hidden = !state.destErrors.photo;
    el.fDestPhoto.classList.toggle('has-error', !!state.destErrors.photo);
  }

  // Downscale + re-encode the uploaded image so a phone photo (often several
  // MB) doesn't blow through localStorage's ~5MB quota.
  function resizeImageFile(file, maxDim, quality) {
    maxDim = maxDim || 900;
    quality = quality || 0.8;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onDestPhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      state.destErrors = { ...state.destErrors, photo: '이미지 파일만 업로드할 수 있어요.' };
      renderDestFormErrors();
      el.fDestPhoto.value = '';
      return;
    }
    try {
      const dataUrl = await resizeImageFile(file);
      state.destForm.photoDataUrl = dataUrl;
      state.destErrors = { ...state.destErrors, photo: '' };
      el.destPhotoPreview.src = dataUrl;
      el.destPhotoPreviewWrap.hidden = false;
      renderDestFormErrors();
    } catch (err) {
      state.destErrors = { ...state.destErrors, photo: '사진을 불러오지 못했어요. 다른 파일을 시도해주세요.' };
      renderDestFormErrors();
    }
  }

  function removeDestPhoto() {
    state.destForm.photoDataUrl = '';
    el.fDestPhoto.value = '';
    el.destPhotoPreviewWrap.hidden = true;
  }

  function submitDestination(e) {
    e.preventDefault();
    const f = {
      name: el.fDestName.value,
      region: el.fDestRegion.value,
      category: el.fDestCategory.value,
      desc: el.fDestDesc.value
    };
    const er = {};
    if (!f.name.trim()) er.name = '여행지 이름을 입력해주세요.';
    if (!f.region.trim()) er.region = '지역을 입력해주세요.';
    if (!f.category) er.category = '카테고리를 선택해주세요.';
    if (!f.desc.trim() || f.desc.trim().length < 5) er.desc = '설명을 5자 이상 입력해주세요.';

    state.destErrors = er;
    if (Object.keys(er).length) {
      renderDestFormErrors();
      const order = ['name', 'region', 'category', 'desc'];
      const firstBad = order.find((k) => er[k]);
      if (firstBad) el['fDest' + firstBad[0].toUpperCase() + firstBad.slice(1)].focus();
      return;
    }

    const id = 'dest-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const grad = PLACEHOLDER_GRADIENTS[Math.floor(Math.random() * PLACEHOLDER_GRADIENTS.length)];
    const newDest = {
      id, name: f.name.trim(), region: f.region.trim(), category: f.category,
      desc: f.desc.trim(), grad, photo: state.destForm.photoDataUrl || null,
      l: 0, d: 0, custom: true
    };

    const nextCustom = [...state.customDestinations, newDest];
    const ok = save('roameo_customDestinations', nextCustom);
    if (!ok) {
      state.destErrors = { photo: '저장 공간이 부족해요. 사진 없이 등록하거나 다른 사진으로 시도해주세요.' };
      renderDestFormErrors();
      return;
    }
    state.customDestinations = nextCustom;

    closeAddDestModal();
    renderGrid();
    renderHeroStats();
    renderPoll();
  }

  /* ------------------------------------------------------------------ *
   * Detail modal (자세히) + reviews
   * ------------------------------------------------------------------ */
  function starRowHtml(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) html += `<span class="${i <= rating ? '' : 'star--empty'}">★</span>`;
    return html;
  }

  function openDetail(id) {
    state.detailId = id;
    state.reviewForm = { name: '', rating: 0, comment: '' };
    state.reviewErrors = {};
    renderDetailModal();
    openDialog(el.detailOverlay, el.detailCloseBtn);
  }
  function closeDetailModal() { closeDialog(el.detailOverlay); }

  // Upload / replace the photo for the currently open destination (any card).
  async function onDetailPhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { el.detailPhotoInput.value = ''; return; }
    try {
      const dataUrl = await resizeImageFile(file);
      const next = { ...state.photoOverrides, [state.detailId]: dataUrl };
      const ok = save('roameo_photoOverrides', next);
      if (!ok) {
        alert('저장 공간이 부족해요. 더 작은 사진으로 다시 시도해주세요.');
        el.detailPhotoInput.value = '';
        return;
      }
      state.photoOverrides = next;
      renderDetailModal();
      renderGrid();
    } catch (err) {
      alert('사진을 불러오지 못했어요. 다른 파일을 시도해주세요.');
      el.detailPhotoInput.value = '';
    }
  }

  function removeDetailPhoto() {
    const next = { ...state.photoOverrides };
    delete next[state.detailId];
    state.photoOverrides = next;
    save('roameo_photoOverrides', next);
    renderDetailModal();
    renderGrid();
  }

  function renderDetailModal() {
    const d = findDestination(state.detailId);
    if (!d) return;

    const photo = photoOf(d);
    el.detailBanner.style.background = photo ? `center/cover no-repeat url(${photo})` : d.grad;
    el.detailBadge.textContent = d.category;
    el.detailName.textContent = d.name;
    el.detailRegion.textContent = d.region;
    el.detailDesc.textContent = d.desc;
    el.detailLikes.textContent = likesOf(d);
    el.detailDislikes.textContent = dislikesOf(d);

    // Photo add/replace/remove controls in the banner.
    el.detailPhotoBtnText.textContent = photo ? '사진 변경' : '사진 추가';
    el.detailPhotoRemoveBtn.hidden = !photo;
    el.detailPhotoInput.value = '';

    const reviews = getReviewsFor(d.id);
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    el.detailRatingStars.innerHTML = starRowHtml(Math.round(avg));
    el.detailRatingAvg.textContent = reviews.length ? avg.toFixed(1) : '리뷰 없음';
    el.detailReviewCount.textContent = reviews.length ? `(${reviews.length})` : '';

    el.detailReviews.innerHTML = reviews.length
      ? reviews.map((r) => `
        <li class="review-item">
          <div class="review-item__top">
            <span class="review-item__name">${escapeHtml(r.name)}</span>
            <span class="review-item__stars">${starRowHtml(r.rating)}</span>
          </div>
          <p class="review-item__comment">${escapeHtml(r.comment)}</p>
        </li>`).join('')
      : '<li class="review-empty">아직 등록된 리뷰가 없어요. 첫 리뷰를 남겨보세요!</li>';

    renderReviewForm();
  }

  // Sets input values from state (only needed when the modal opens / resets)
  // and delegates the star picker + error text to their own renderers.
  function renderReviewForm() {
    el.fReviewName.value = state.reviewForm.name;
    el.fReviewComment.value = state.reviewForm.comment;
    renderStarPicker();
    renderReviewErrors();
  }

  // Rebuilt independently of renderReviewForm() so that picking a star
  // rating never touches (and can't clobber) whatever the user has already
  // typed into the name/comment fields.
  function renderStarPicker() {
    el.reviewStarPicker.innerHTML = [1, 2, 3, 4, 5].map((v) => `
      <button type="button" class="star-btn${v <= state.reviewForm.rating ? ' is-on' : ''}"
              data-val="${v}" role="radio" aria-checked="${v === state.reviewForm.rating}" aria-label="별점 ${v}점">★</button>
    `).join('');
    el.reviewStarPicker.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.reviewForm.rating = Number(btn.getAttribute('data-val'));
        state.reviewErrors.rating = '';
        renderStarPicker();
        renderReviewErrors();
      });
    });
  }

  function renderReviewErrors() {
    const nameErr = document.getElementById('fReviewNameError');
    nameErr.textContent = state.reviewErrors.name || '';
    nameErr.hidden = !state.reviewErrors.name;
    el.fReviewName.classList.toggle('has-error', !!state.reviewErrors.name);

    const ratingErr = document.getElementById('fReviewRatingError');
    ratingErr.textContent = state.reviewErrors.rating || '';
    ratingErr.hidden = !state.reviewErrors.rating;

    const commentErr = document.getElementById('fReviewCommentError');
    commentErr.textContent = state.reviewErrors.comment || '';
    commentErr.hidden = !state.reviewErrors.comment;
    el.fReviewComment.classList.toggle('has-error', !!state.reviewErrors.comment);
  }

  function submitReview(e) {
    e.preventDefault();
    // name/comment are kept in sync live via their input listeners (see
    // bindEvents) so reading from state here can't be stale.
    const f = state.reviewForm;
    const er = {};
    if (!f.name.trim()) er.name = '이름을 입력해주세요.';
    if (!f.rating) er.rating = '별점을 선택해주세요.';
    if (!f.comment.trim()) er.comment = '한줄평을 입력해주세요.';

    state.reviewErrors = er;
    if (Object.keys(er).length) { renderReviewErrors(); return; }

    const list = state.reviews[state.detailId] ? [...state.reviews[state.detailId]] : [];
    list.push({ name: f.name.trim(), rating: f.rating, comment: f.comment.trim() });
    state.reviews = { ...state.reviews, [state.detailId]: list };
    save('roameo_reviews', state.reviews);

    state.reviewForm = { name: '', rating: 0, comment: '' };
    state.reviewErrors = {};
    renderDetailModal();
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function bindEvents() {
    // Logo → home
    el.logoLink.addEventListener('click', (e) => { e.preventDefault(); goHome(); });

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

    // Sort + favorites-only + add destination
    el.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
    el.favOnlyBtn.addEventListener('click', () => {
      state.favOnly = !state.favOnly;
      renderToolbarState();
      renderGrid();
      renderMode();
    });
    el.resetFiltersBtn.addEventListener('click', resetFilters);
    el.addDestBtn.addEventListener('click', openAddDestModal);

    // Countdown date + open application modal
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

    // Shared modal keyboard behaviour (Escape + focus trap)
    document.addEventListener('keydown', onGlobalKeydown);

    // Application modal
    el.modalOverlay.addEventListener('click', closeModal);
    el.modalBox.addEventListener('click', (e) => e.stopPropagation());
    el.modalCloseBtn.addEventListener('click', closeModal);
    el.modalConfirmBtn.addEventListener('click', closeModal);
    el.newApplicationBtn.addEventListener('click', newApplication);
    el.fName.addEventListener('input', setFormField('name'));
    el.fEmail.addEventListener('input', setFormField('email'));
    el.fPhone.addEventListener('input', setFormField('phone'));
    el.fPeople.addEventListener('input', setFormField('people'));
    el.fDepart.addEventListener('input', setFormField('depart'));
    el.fArrive.addEventListener('input', setFormField('arrive'));
    el.fAgree.addEventListener('change', (e) => { state.form.agree = e.target.checked; });
    el.applicationForm.addEventListener('submit', submitForm);

    // Add-destination modal
    el.addDestOverlay.addEventListener('click', closeAddDestModal);
    el.addDestBox.addEventListener('click', (e) => e.stopPropagation());
    el.addDestCloseBtn.addEventListener('click', closeAddDestModal);
    el.fDestPhoto.addEventListener('change', onDestPhotoChange);
    el.destPhotoRemoveBtn.addEventListener('click', removeDestPhoto);
    el.addDestForm.addEventListener('submit', submitDestination);

    // Detail modal
    el.detailOverlay.addEventListener('click', closeDetailModal);
    el.detailBox.addEventListener('click', (e) => e.stopPropagation());
    el.detailCloseBtn.addEventListener('click', closeDetailModal);
    el.detailPhotoInput.addEventListener('change', onDetailPhotoChange);
    el.detailPhotoRemoveBtn.addEventListener('click', removeDetailPhoto);
    el.fReviewName.addEventListener('input', (e) => { state.reviewForm.name = e.target.value; });
    el.fReviewComment.addEventListener('input', (e) => { state.reviewForm.comment = e.target.value; });
    el.reviewForm.addEventListener('submit', submitReview);

    // Random pick modal
    el.randomOverlay.addEventListener('click', closeRandomModal);
    el.randomBox.addEventListener('click', (e) => e.stopPropagation());
    el.randomCloseBtn.addEventListener('click', closeRandomModal);
    el.randomAgainBtn.addEventListener('click', randomAgain);
    el.randomDetailBtn.addEventListener('click', randomOpenDetail);
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
    populateDestCategorySelect();
    renderMode();
  }

  init();
  bindEvents();
  renderAll();
  setInterval(renderCountdown, 1000);
})();
