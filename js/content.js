/* 사이트 내용 불러오기 — data/site.js 의 기본값 위에 서버 값을 덮습니다.
   · 보통: site_versions 에서 apply_at ≤ 지금 인 최신 판 하나 (예약 시스템 '홈페이지 관리' 에서 적용한 것)
   · ?preview=1 : site_draft (아직 적용 안 한 초안) — 관리 화면의 미리보기가 이 주소를 엽니다
   서버가 없거나(js/config.js 없음) 느리거나 죽으면 기본값으로 그립니다. 마지막으로 받은 값은 localStorage 에 두고
   다음 방문 때 먼저 씁니다(글이 바뀌어 있어도 깜빡임 없이).
   화면은 값이 정해질 때까지 잠깐 숨깁니다(html.pending — 1.5초 넘으면 그냥 보여줌).
   ★ 홈페이지 예약 창의 코스 목록·특별 기간은 예약 시스템 설정이 원본(09-25 재아) — 공개 뷰 public_screen(38차)에서 받음.
     차림 장은 홈페이지 자료(홈페이지 관리 → 차림) 그대로. 받지 못하면(서버 죽음) 예약 창도 홈페이지 자료로 */
(function(){
  const preview = /[?&]preview=1/.test(location.search);
  const CACHE = "hanok-site-live";
  const show = () => document.documentElement.classList.remove("pending");
  const merge = (base, over) => {   /* 객체는 키별로, 배열·문자열·숫자는 서버 값이 통째로 */
    if(!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
    const out = Object.assign({}, base || {});
    Object.keys(over).forEach(k => { out[k] = (base && typeof base[k] === "object" && !Array.isArray(base[k])) ? merge(base[k], over[k]) : over[k]; });
    return out;
  };
  /* 예약 시스템 설정 → 홈페이지 예약 창. 차림 장(MENU)은 홈페이지 자료 그대로 두고,
     window.SYS_MENU(코스 묶음)와 SITE.online.special(특별 기간)만 예약 시스템 값으로 — 예약 창(reserve.js menuGroups)이 씀.
     접수 코스 키는 'cg:묶음id|이름' — 예약 시스템이 이름 맞추기 없이 그 코스로 넣습니다(11b reqCourses) */
  const withSys = (S, set) => {
    window.SYS_MENU = (set && Array.isArray(set.courseGroups)) ? set : null;
    if(!window.SYS_MENU) return S;
    const out = Object.assign({}, S, { online: Object.assign({}, S.online) });
    const sn = (sp, k, names) => (names || []).map(n => ({ name: n, cn: ((sp.info || {})[n] || {}).cn || "", key: "cg:sp_" + sp.id + "_" + k + "|" + n }));   /* 평소 코스와 같은 이름이면 예약 시스템이 평소 코스로 이어 줌 */
    out.online.special = (set.specials || []).filter(sp => sp && sp.from && sp.to).map(sp => ({
      title: sp.title || "", from: sp.from, to: sp.to, note: sp.note || "", open: !!sp.open, openFrom: sp.openFrom || "", openTo: sp.openTo || "",
      lunchOff: !!sp.lunchOff, courses: sn(sp, "d", sp.dinner), lunch: sn(sp, "l", sp.lunch) }));
    return out;
  };
  let siteData = null, sysSet = null;
  const draw = () => { const S = (siteData && typeof siteData === "object" && Object.keys(siteData).length) ? merge(window.SITE_DEFAULT, siteData) : window.SITE_DEFAULT; window.applySiteGlobals(withSys(S, sysSet)); };
  const apply = data => { if(data && typeof data === "object" && Object.keys(data).length){ siteData = data; draw(); } };
  const MCACHE = "hanok-menu-live";

  let cached = null;
  if(!preview){ try{ cached = JSON.parse(localStorage.getItem(CACHE) || "null"); }catch(e){} }
  try{ sysSet = JSON.parse(localStorage.getItem(MCACHE) || "null"); }catch(e){}
  if(cached && cached.data) apply(cached.data); else if(sysSet) draw();

  const C = window.SUPA;
  let done;
  if(!C || !C.url || !C.anonKey){ done = Promise.resolve(); }
  else{
    const H = { "apikey": C.anonKey, "Authorization": "Bearer " + C.anonKey };
    const path = preview
      ? `/rest/v1/site_draft?store=eq.${C.store}&select=data,updated_at`
      : `/rest/v1/site_versions?store=eq.${C.store}&apply_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,data,apply_at&order=apply_at.desc&limit=1`;
    const site = fetch(C.url + path, {headers:H}).then(r => r.ok ? r.json() : []).then(rows => {
      const row = rows && rows[0];
      if(!row){ if(!preview){ try{ localStorage.removeItem(CACHE); }catch(e){} siteData = null; } return; }
      siteData = row.data;
      if(!preview){ try{ localStorage.setItem(CACHE, JSON.stringify({at:Date.now(), id:row.id, data:row.data})); }catch(e){} }
    }).catch(() => {});
    /* 코스·특별 기간(예약 시스템 설정) — 미리보기에서도 지금 값(설정은 '적용하기' 한 것만 서버에 있음) */
    const sys = fetch(C.url + `/rest/v1/public_screen?store=eq.${C.store}&select=settings`, {headers:H}).then(r => r.ok ? r.json() : []).then(rows => {
      const st = rows && rows[0] && rows[0].settings;
      if(st && Array.isArray(st.courseGroups)){ sysSet = { courseGroups: st.courseGroups, specials: st.specials || [] }; try{ localStorage.setItem(MCACHE, JSON.stringify(sysSet)); }catch(e){} }
    }).catch(() => {});
    done = Promise.all([site, sys]).then(draw);
  }
  const timeout = new Promise(r => setTimeout(r, 1500));
  window.SITE_READY = Promise.race([done, timeout]).then(() => { show(); window.SITE_PREVIEW = preview; return window.SITE; });
  /* 미리보기 표시 띠 — 손님이 볼 일은 없지만, 관리 화면 안에서 초안인지 한눈에 */
  if(preview) window.SITE_READY.then(() => { const b = document.createElement("div"); b.className = "preview-bar"; b.textContent = "미리보기 — 아직 적용하지 않은 초안입니다"; document.body.classList.add("has-preview"); document.body.append(b); });
})();
