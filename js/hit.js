/* ---------- 방문 세기 (09-24 재아: 개발자 페이지 통계) ----------
   장을 열 때 한 줄: 어느 장 · 이 브라우저의 무작위 번호(하루 방문자 수를 세려고, 이름·IP 같은 건 없음) · 어디서 왔나 · 폰/태블릿/PC.
   예약 창 열림·접수도 같은 표에 'ev:' 로(js/reserve.js 가 부름). 미리보기(?preview)·화면 캡처(?shot)·로봇·내 PC(localhost)는 안 셈. 실패해도 조용히.

   10-03: js/site.js 안에 있던 것을 이 파일로 뗌 — 바로 예약 장(reserve.html)은 site.js 를 안 읽어서
          /reserve 로 온 손님의 방문·예약 창 열림·접수가 통계에서 통째로 빠져 있었음. 이제 모든 장이 이 파일을 읽음.

   출처 꼬리표 ?src=이름 (10-03) — 네이버 지도·인스타 프로필·QR 에 거는 주소 끝에 붙임. 예) hanokbanjeom.com/reserve?src=naver
     · 이름은 영문 소문자·숫자·- 만, 20자까지(그 밖은 버림 — 아무나 쓸 수 있는 표라 통계가 더러워지지 않게).
     · 통계의 '어디서 왔나' 에 'src:naver' 처럼 나옴. 꼬리표가 있으면 온 도메인 대신 꼬리표를 적음(앱 안 브라우저는 도메인이 안 넘어와서).
     · 같은 탭에서 다른 장으로 넘어가도 유지(sessionStorage) — 예약 접수까지 같은 출처로 셈.
     · 시험은 ?src=test — 기록하지 않음.
     · 꼬리표에 이름·전화 같은 개인정보를 넣지 않습니다. */
window.hanokHit = (function(){
  const S = window.SUPA;
  let tag = "";
  try{ const m = location.search.match(/[?&]src=([^&#]*)/); if(m) tag = decodeURIComponent(m[1]).toLowerCase(); }catch(e){ tag = ""; }
  if(!/^[a-z0-9-]{1,20}$/.test(tag)) tag = "";
  try{ if(tag) sessionStorage.setItem("hanok-src", tag); else tag = sessionStorage.getItem("hanok-src") || ""; }catch(e){}
  if(!/^[a-z0-9-]{1,20}$/.test(tag)) tag = "";
  const skip = !S || !S.url || /localhost|127\.0\.0\.1/.test(location.hostname) || /[?&](preview|shot|only)=/.test(location.search) || tag === "test" ||
               navigator.webdriver || /bot|crawl|spider|slurp|preview|headless/i.test(navigator.userAgent);
  let vid = "";
  try{ vid = localStorage.getItem("hanok-vid") || ""; if(!vid){ vid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("hanok-vid", vid); } }
  catch(e){ vid = "x" + Math.random().toString(36).slice(2, 12); }
  const dev = innerWidth < 760 ? "mobile" : innerWidth < 1100 ? "tablet" : "pc";
  let ref = ""; try{ const h = document.referrer ? new URL(document.referrer).hostname : ""; ref = h && h !== location.hostname ? h.replace(/^www\./, "").slice(0, 80) : ""; }catch(e){}
  if(tag) ref = "src:" + tag;
  return function(page){
    if(skip) return;
    try{
      fetch(S.url + "/rest/v1/site_hits", { method:"POST", keepalive:true,
        headers:{ apikey:S.anonKey, Authorization:"Bearer " + S.anonKey, "Content-Type":"application/json", Prefer:"return=minimal" },
        body:JSON.stringify({ store:S.store || "hanok", page:String(page).slice(0, 40), vid:vid, ref:ref, dev:dev }) }).catch(() => {});
    }catch(e){}
  };
})();
/* 장 이름: <body data-page> 가 있으면 그것, 없으면 주소(예: /reserve → reserve). 맨 위(/)는 home */
window.hanokHit((document.body && document.body.dataset.page) || location.pathname.replace(/^\/|\.html$/g, "") || "home");
