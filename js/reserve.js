/* 한옥반점 예약 창 — 어느 장에서든 [data-reserve] 를 누르면 뜹니다.

   흐름(한 화면에 하나씩) ① 인원 → ② 날짜 → ③ 시간 → ④ 자리 → ⑤ 메뉴 → ⑥ 예약자 정보 → ⑦ 예약 확인 → 접수
   접수는 바로 확정이 아닙니다. 가게에서 확인한 뒤 문자로 확정합니다(예약 시스템 '손님 요청' 칸으로 들어갈 예정).
   제한 시간 5분은 시간을 고른 다음(④)부터 흐릅니다.
   당일 예약은 관리 화면의 '당일 예약' 스위치(SITE.online.sameDay)를 켰을 때만 — 그때도 지금부터 sameDayLeadH 시간 뒤 시각만. 어린이는 유아를 포함합니다.

   입력은 브라우저 기본 위젯을 쓰지 않습니다. 달력·인원·시간 모두 직접 그립니다(기기마다 같은 모습이어야 해서).

   ★ 예약 시스템과 이어붙일 곳은 RES_API 셋뿐입니다. 지금은 영업시간 규칙으로 흉내냅니다.
     month(ym, people, seat)   → {"2026-09-18": 11, …}  그 달 각 날짜에 남은 시각 수(0이면 달력에서 잠김)
     slots(date, people, seat) → ["11:00","11:30", …]    그 날 고를 수 있는 시각
     submit(payload)           → {ok:true}               '손님 요청' 으로 저장 */
(function(){
  const $ = (s, r) => (r||document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const pad = n => String(n).padStart(2,"0");
  const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const mins = t => Number(t.slice(0,2))*60 + Number(t.slice(3));
  const hm = t => { const h = Math.floor(mins(t)/60), m = mins(t)%60; return (h<12?"오전":"오후")+" "+(h%12===0?12:h%12)+":"+pad(m); };
  const WD = ["일","월","화","수","목","금","토"];
  const dateText = s => { const d = new Date(s+"T00:00:00"); return (d.getMonth()+1)+"월 "+d.getDate()+"일 ("+WD[d.getDay()]+")"; };
  /* 접수 규칙은 SITE.online(관리 화면에서 바꿈). 값이 없으면 아래 기본값. 서버 정책(성인 2~12·룸 성인 5·내일부터)이 최종이라 그 밖으로 넓힐 수는 없습니다 */
  const R = () => Object.assign({enabled:true, maxDays:30, minAdults:2, maxPeople:12, roomMinAdults:5, limitMin:5, sameDay:false, sameDayLeadH:2,
                                 offTitle:"지금은 온라인 예약을 받지 않습니다", offMsg:"예약은 전화로 부탁드립니다."}, (window.SITE && SITE.online) || {});
  const MAX_SEAT = 40, LUNCH_END = 15*60+30, CODE_SEC = 120, RESEND_WAIT_SEC = 60;
  const LIMIT_SEC = () => Math.max(1, R().limitMin || 5) * 60;

  /* ---------- 흉내 API ---------- */
  const isHoliday = s => { const d = new Date(s+"T00:00:00"); return d.getDay() === 0 || (window.HOLIDAYS||[]).indexOf(s) >= 0; };
  const isWeekend = s => { const d = new Date(s+"T00:00:00"); return d.getDay() === 6 || isHoliday(s); };
  /* 가짜 만석: 금·토 저녁 18:00·18:30 룸은 찼다고 칩니다. 실제로는 예약 현황에서 옵니다 */
  /* 당일이면 '지금 + 여유 시간' 이전 시각은 뺍니다(09-24). 당일을 끈 동안은 오늘을 달력에서 아예 못 고르니 여기 안 옴 */
  const leadCut = (date, list) => {
    const n = new Date(), today = n.getFullYear() + "-" + pad(n.getMonth()+1) + "-" + pad(n.getDate());
    if(date !== today) return list;
    const from = n.getHours()*60 + n.getMinutes() + Math.max(1, R().sameDayLeadH || 2)*60;
    return list.filter(t => { const p = t.split(":"); return (+p[0])*60 + (+p[1]) >= from; });
  };
  const stubFull = (date, time, seat) => { const wd = new Date(date+"T00:00:00").getDay(); return seat === "room" && (wd === 5 || wd === 6) && (time === "18:00" || time === "18:30"); };
  window.RES_API = window.RES_API || {
    slots: async (date, people, seat) => {
      if((window.CLOSED||[]).indexOf(date) >= 0) return [];
      const out = []; const add = (a, b) => { for(let x = a; x <= b; x += 30) out.push(pad(Math.floor(x/60))+":"+pad(x%60)); };
      /* 접수 시각 = 예약 시스템 세션과 같은 값: 평일 점심 11:00–14:00 · 저녁 17:00–19:30, 토 11:00–19:30, 일·공휴일 11:00–18:00 */
      if(isHoliday(date)) add(11*60, 18*60);
      else if(isWeekend(date)) add(11*60, 19*60+30);
      else { add(11*60, 14*60); add(17*60, 19*60+30); }
      return leadCut(date, out.filter(t => seat === "any" || !stubFull(date, t, seat)));
    },
    /* 기본 구현은 slots 를 날마다 불러 셉니다. 실제로는 한 번에 받아오게 바꾸세요 */
    month: async function(ym, people, seat){
      const out = {}, first = new Date(ym+"-01T00:00:00");
      const last = new Date(first.getFullYear(), first.getMonth()+1, 0).getDate();
      for(let d = 1; d <= last; d++){ const key = ym+"-"+pad(d); out[key] = (await this.slots(key, people, seat)).length; }
      return out;
    },
    submit: async payload => { await new Promise(r => setTimeout(r, 600)); return {ok:true}; },
    /* 그 시각에 이 좌석 종류로 받을 수 있나 — 시간표는 '룸이든 테이블이든' 되는 시각을 보여 주므로 좌석 단계에서 한 번 더 봅니다 */
    seatOk: async (date, time, people, seat) => !stubFull(date, time, seat)
  };

  /* ---------- 진짜 API: js/config.js 에 window.SUPA 가 있으면 예약 시스템(Supabase)과 붙습니다 ----------
     · 남은 자리는 public_avail 표(예약 시스템 태블릿이 30일치를 올려 둠)를 읽습니다 —
       {"11:00":{"rooms":[[최소,최대],…],"tableMax":n}, …}. 룸은 인원이 어느 룸의 범위에 들면, 테이블은 tableMax 이하면 가능.
     · 접수는 requests 표에 한 줄. 서버가 규칙(내일부터·성인 2·룸 성인 5·12명 이하·번호당 하루 5건)을 한 번 더 확인합니다. */
  if(window.SUPA && SUPA.url && SUPA.anonKey){
    const H = { "apikey": SUPA.anonKey, "Authorization": "Bearer " + SUPA.anonKey, "Content-Type": "application/json" };
    const get = async path => { const r = await fetch(SUPA.url + path, {headers:H}); if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
    const okAt = (e, people, seat) => {
      if(!e) return false;
      const room = (e.rooms||[]).some(([mn, mx]) => people >= mn && people <= mx), table = people <= (e.tableMax||0);
      return seat === "room" ? room : seat === "table" ? table : (room || table);
    };
    const availCache = {};
    const dayData = async date => { if(!(date in availCache)){ const rows = await get(`/rest/v1/public_avail?store=eq.${SUPA.store}&date=eq.${date}&select=data`); availCache[date] = rows[0] ? rows[0].data : null; } return availCache[date]; };
    RES_API.slots = async (date, people, seat) => {
      const d = await dayData(date); if(!d) return [];
      return leadCut(date, Object.keys(d).sort().filter(t => okAt(d[t], people, seat)));
    };
    RES_API.seatOk = async (date, time, people, seat) => { const d = await dayData(date); return !!(d && okAt(d[time], people, seat)); };
    RES_API.month = async (ym, people, seat) => {
      const rows = await get(`/rest/v1/public_avail?store=eq.${SUPA.store}&date=like.${ym}%25&select=date,data`);
      const out = {}; rows.forEach(r => { availCache[r.date] = r.data; out[r.date] = leadCut(r.date, Object.keys(r.data||{}).filter(t => okAt(r.data[t], people, seat))).length; });
      /* 표에 없는 날(태블릿이 아직 안 올린 날)은 0 = 고를 수 없음 */
      const first = new Date(ym + "-01T00:00:00"), last = new Date(first.getFullYear(), first.getMonth()+1, 0).getDate();
      for(let i = 1; i <= last; i++){ const k = ym + "-" + pad(i); if(!(k in out)) out[k] = 0; }
      return out;
    };
    RES_API.submit = async p => {
      const body = { id:"rq_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36), store:SUPA.store,
        date:p.date, time:p.time, adults:p.adults, kids:p.kids, people:p.people, seat:p.seat, course:p.course, course_label:p.courseLabel,
        name:p.name, phone:String(p.phone).replace(/\D/g,""), request:p.request||"", allergy:p.allergy||"", status:"대기" };
      const r = await fetch(SUPA.url + "/rest/v1/requests", { method:"POST", headers:Object.assign({"Prefer":"return=minimal"}, H), body:JSON.stringify(body) });
      if(r.ok) return {ok:true, id:body.id};
      let msg = ""; try{ msg = (await r.json()).message || ""; }catch(e){}
      if(/RATE_PHONE/.test(msg)) return {ok:false, msg:"이 번호로 오늘 접수한 예약이 이미 5건입니다. 전화로 문의해 주세요."};
      if(/RATE_ALL/.test(msg)) return {ok:false, msg:"지금 접수가 몰려 있습니다. 잠시 뒤 다시 시도해 주세요."};
      return {ok:false, msg:"접수가 되지 않았습니다. 잠시 뒤 다시 시도하시거나 전화로 문의해 주세요."};
    };
  }

  /* ---------- 상태 ---------- */
  let S, step, timer, left, ov, monthCache, extended;   /* extended: 5분 연장을 한 번 썼는지 */
  const total = () => S.adults + S.kids;
  const tooMany = () => total() > R().maxPeople;
  function reset(){
    S = {date:"", adults:0, kids:0, time:"", seat:"", course:"", courseLabel:"", name:"", phone:"",
         sent:false, resendUsed:false, verified:false, req:"", allergy:"", agree:{rule:false, priv:false, age:false}};
    step = 1; monthCache = {};
    clearInterval(timer); timer = null; left = LIMIT_SEC(); extended = false;
  }

  /* ---------- 창 ---------- */
  function open(){
    if(ov) return;
    reset();
    ov = document.createElement("div"); ov.className = "rv-ov";
    ov.innerHTML = `<div class="rv" role="dialog" aria-modal="true" aria-label="예약">
        <div class="rv-h">
          <div class="rv-ttl"><span>한옥반점</span><h2>예약</h2></div>
          <div class="rv-timer" hidden><span>시간 내 예약을 완료해 주세요</span><b id="rv-clock">5:00</b><button type="button" class="rv-ext" id="rv-ext" hidden>+5분</button></div>
          <button class="rv-x" aria-label="닫기"><svg viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16"/></svg></button>
        </div>
        <ol class="rv-steps"></ol>
        <div class="rv-b"></div>
        <div class="rv-f"></div>
      </div>`;
    document.body.append(ov); document.body.classList.add("rv-open");
    ov.addEventListener("click", e => { if(e.target === ov) confirmClose(); });
    $(".rv-x", ov).addEventListener("click", confirmClose);
    document.addEventListener("keydown", onKey);
    render();
  }
  function close(){
    if(!ov) return;
    clearInterval(timer); timer = null;
    ov.remove(); ov = null;
    document.body.classList.remove("rv-open");
    document.removeEventListener("keydown", onKey);
  }
  function confirmClose(){
    if(step > 1 && step < 8){ ask("예약을 그만두시겠습니까?", "입력하신 내용은 저장되지 않습니다.", "그만두기", close); return; }
    close();
  }
  function onKey(e){ if(e.key === "Escape"){ if($(".rv-ask", ov)) $(".rv-ask .no", ov).click(); else confirmClose(); } }

  /* 창 안에서 묻는 작은 확인 상자 */
  function ask(title, body, okLabel, onOk){
    const box = document.createElement("div"); box.className = "rv-ask";
    box.innerHTML = `<div class="rv-ask-in" role="alertdialog" aria-modal="true">
        <h4>${esc(title)}</h4><p>${body}</p>
        <div class="rv-ask-f"><button type="button" class="btn ghost no">취소</button><button type="button" class="btn fill yes">${esc(okLabel)}</button></div>
      </div>`;
    $(".rv", ov).append(box);
    $(".no", box).addEventListener("click", () => box.remove());
    $(".yes", box).addEventListener("click", () => { box.remove(); onOk(); });
    $(".yes", box).focus();
  }

  function startTimer(){
    if(timer) return;
    $(".rv-timer", ov).hidden = false;
    /* 1분 남으면 '+5분' 이 나타나고, 한 번만 쓸 수 있습니다 */
    $("#rv-ext", ov).addEventListener("click", () => { if(extended) return; extended = true; left += LIMIT_SEC(); $("#rv-ext", ov).hidden = true; tick(); });
    tick(); timer = setInterval(tick, 1000);
  }
  function tick(){
    if(!ov) return;
    const c = $("#rv-clock", ov); if(!c) return;
    c.textContent = Math.floor(left/60)+":"+pad(left%60);
    c.classList.toggle("warn", left <= 60);
    const ext = $("#rv-ext", ov); if(ext) ext.hidden = !(left <= 60 && !extended);
    if(left <= 0){
      clearInterval(timer); timer = null;
      const keep = {adults:S.adults, kids:S.kids, date:S.date};
      reset(); Object.assign(S, keep);
      $(".rv-timer", ov).hidden = true;
      render("시간이 만료되었습니다.");
      return;
    }
    left--;
  }

  /* ---------- 온라인으로 못 받는 조합은 전화로 ---------- */
  function phoneOnly(){
    if(S.seat === "room" && S.adults < roomMin(S.date)) return `룸 예약은 성인 기준 ${roomMin(S.date)}명부터 받고 있습니다.`;
    return "";
  }
  const telBox = msg => `<div class="rv-note">${esc(msg)}<a class="rv-tel-lnk" href="tel:${INFO.tel}">${esc(INFO.tel)}</a></div>`;

  /* ---------- 틀 ---------- */
  const STEPS = ["인원", "날짜", "시간", "좌석", "메뉴", "예약자 정보", "예약 확인"];
  function render(msg){
    const steps = $(".rv-steps", ov);
    /* 접수 중단(관리 화면에서 끔) — 단계 없이 안내와 전화만 */
    if(!R().enabled){
      steps.hidden = true;
      $(".rv-b", ov).innerHTML = `<section class="rv-sec rv-off"><h3>${esc(R().offTitle)}</h3><p>${esc(R().offMsg).replace(/\n/g, "<br>")}</p></section>`;
      $(".rv-f", ov).innerHTML = `<a class="rv-call" href="tel:${INFO.tel}"><b>전화로 예약</b><span>${esc(INFO.tel)}</span></a><button type="button" class="btn ghost" data-off-close>닫기</button>`;
      $("[data-off-close]", ov).addEventListener("click", close);
      return;
    }
    steps.hidden = step > STEPS.length;
    steps.innerHTML = STEPS.map((t,i) => `<li class="${i+1===step?'on':(i+1<step?'done':'')}"><i>${i+1}</i>${t}</li>`).join("");
    const b = $(".rv-b", ov), f = $(".rv-f", ov);
    b.scrollTop = 0;
    b.innerHTML = msg ? `<div class="rv-msg">${esc(msg)}</div>` : "";
    [null, sPeople, sDate, sTime, sSeat, sMenu, sGuest, sConfirm, done][step](b, f);
    const on = steps.querySelector(".on"); if(on && on.scrollIntoView) on.scrollIntoView({block:"nearest", inline:"center"});
  }
  /* warn 을 주면 다음 버튼 왼쪽에 경고 문구가 뜹니다(이전 버튼 자리).
     '전화로 예약' 안내는 다음 버튼이 막혔을 때(온라인으로 못 받는 경우)만 — 늘 보이면 전화하라는 뜻으로 읽힘(재아 2026-09-17) */
  function foot(f, prev, next, label, off, warn){
    const leftEl = warn ? `<div class="rv-warn">${warn}</div>`
                 : prev ? `<button type="button" class="btn ghost" data-prev>이전</button>`
                 : off ? `<a class="rv-call" href="tel:${INFO.tel}"><b>전화로 예약</b><span>${esc(INFO.tel)}</span></a>` : `<span></span>`;
    f.innerHTML = leftEl + `<button type="button" class="btn fill" data-next${off?" disabled":""}>${label||"다음"}</button>`;
    if(prev) $("[data-prev]", f).addEventListener("click", () => { step--; render(); });
    $("[data-next]", f).addEventListener("click", next);
  }
  const peopleText = () => S.kids ? `성인 ${S.adults} · 어린이 ${S.kids}` : `성인 ${S.adults}`;
  const sumLine = () => {
    const bits = [peopleText()];
    if(S.date) bits.push(dateText(S.date));
    if(S.time) bits.push(hm(S.time));
    if(S.seat) bits.push(S.seat === "room" ? "룸" : "테이블");
    if(S.courseLabel) bits.push(S.courseLabel);
    return `<div class="rv-sum">${bits.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`;
  };
  /* 룸 최소 인원 — 평일 / 주말·공휴일 따로(09-24 재아). 주말 값이 없으면 평일 값 */
  const roomMin = date => (date && isWeekend(date) && R().roomMinAdultsWeekend) ? R().roomMinAdultsWeekend : R().roomMinAdults;
  const dayRange = () => { const t = new Date(); return { min: ymd(R().sameDay ? t : new Date(t.getTime() + 864e5)), max: ymd(new Date(t.getTime() + R().maxDays*864e5)) }; };   /* 내일부터 — '당일 예약' 을 켜면 오늘부터 */

  /* ---------- ① 인원 ---------- */
  function sPeople(b, f){
    const stepper = (key, label, note) => `<div class="rv-cnt" data-k="${key}">
        <div class="rv-cnt-l"><b>${label}</b>${note?`<span>${note}</span>`:""}</div>
        <div class="rv-cnt-r">
          <button type="button" data-d="-1" aria-label="${label} 한 명 줄이기"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
          <b class="rv-cnt-n">${S[key]}</b>
          <button type="button" data-d="1" aria-label="${label} 한 명 늘리기"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
        </div>
      </div>`;
    b.insertAdjacentHTML("beforeend", `<section class="rv-sec">
        <h3>인원</h3>
        ${stepper("adults", "성인")}
        ${stepper("kids", "어린이", "유아 포함")}
      </section>`);
    const ok = () => !tooMany() && S.adults >= R().minAdults;
    function sync(){
      b.querySelectorAll(".rv-cnt").forEach(r => r.querySelectorAll("button").forEach(y =>
        y.disabled = (y.dataset.d === "-1" ? S[r.dataset.k] <= 0 : total() >= MAX_SEAT)));
      const warn = tooMany()
        ? `유선으로 예약 도와드리겠습니다. <a href="tel:${INFO.tel}">${esc(INFO.tel)}</a>`
        : (S.adults < R().minAdults ? `성인 ${R().minAdults}명부터 접수 가능합니다.` : "");
      foot(f, false, next, "다음", !ok(), warn);
    }
    b.querySelectorAll(".rv-cnt").forEach(row => {
      const key = row.dataset.k, num = $(".rv-cnt-n", row);
      row.querySelectorAll("button").forEach(x => x.addEventListener("click", () => {
        const n = Math.max(0, S[key] + Number(x.dataset.d));
        if(n === S[key] || total() - S[key] + n > MAX_SEAT) return;
        S[key] = n; num.textContent = n; monthCache = {}; S.time = ""; sync();
      }));
    });
    function next(){ if(ok()){ step = 2; render(); } }
    sync();
  }

  /* ---------- ② 날짜 ---------- */
  function sDate(b, f){
    const {min, max} = dayRange();
    let view = new Date((S.date || min) + "T00:00:00"); view.setDate(1);
    b.insertAdjacentHTML("beforeend", sumLine() + `<section class="rv-sec">
        <h3>날짜</h3>
        <div class="rv-cal">
          <div class="rv-cal-h">
            <button type="button" class="rv-mo" data-m="-1" aria-label="지난달"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
            <b id="rv-cal-t"></b>
            <button type="button" class="rv-mo" data-m="1" aria-label="다음달"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
          </div>
          <div class="rv-wd">${WD.map((w,i)=>`<span class="${i===0?'sun':(i===6?'sat':'')}">${w}</span>`).join("")}</div>
          <div class="rv-days" id="rv-days"></div>
        </div>
      </section>`);
    const days = $("#rv-days", b), title = $("#rv-cal-t", b);
    b.querySelectorAll(".rv-mo").forEach(x => x.addEventListener("click", () => { view.setMonth(view.getMonth() + Number(x.dataset.m)); draw(); }));
    async function draw(){
      const ym = view.getFullYear()+"-"+pad(view.getMonth()+1);
      title.textContent = view.getFullYear()+"년 "+(view.getMonth()+1)+"월";
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const lastDay = new Date(view.getFullYear(), view.getMonth()+1, 0).getDate();
      b.querySelector('[data-m="-1"]').disabled = ym <= min.slice(0,7);
      b.querySelector('[data-m="1"]').disabled = ym >= max.slice(0,7);
      const cells = [];
      for(let i = 0; i < first.getDay(); i++) cells.push(`<span class="pad"></span>`);
      for(let d = 1; d <= lastDay; d++){
        const key = ym+"-"+pad(d), wd = new Date(key+"T00:00:00").getDay();
        const out = key < min || key > max || !!lockedOf(key);
        cells.push(`<button type="button" data-day="${key}" aria-label="${view.getFullYear()}년 ${view.getMonth()+1}월 ${d}일${out?' 예약 불가':''}" class="${wd===0||isHoliday(key)?'sun':(wd===6?'sat':'')}${key===S.date?' on':''}"${out?" disabled":""}>${d}</button>`);
      }
      days.innerHTML = cells.join("");
      /* 이 달에 잠근 특별 기간이 있으면 달력 아래 한 줄 */
      const locks = (R().special || []).filter(sp => sp && sp.from && sp.to && !spOpenNow(sp) && sp.from.slice(0,7) <= ym && sp.to.slice(0,7) >= ym);
      let ln = b.querySelector(".rv-lock"); if(!ln){ ln = document.createElement("p"); ln.className = "rv-fld-hint rv-lock"; days.after(ln); }
      ln.innerHTML = locks.length ? locks.map(sp => `${esc(sp.title || "특별 기간")} (${esc(sp.from.slice(5).replace("-", "/"))} ~ ${esc(sp.to.slice(5).replace("-", "/"))}) 예약은 준비 중입니다. 전화로 문의해 주세요. <a href="tel:${esc(INFO.tel)}" class="num">${esc(INFO.tel)}</a>`).join("<br>") : "";
      days.querySelectorAll("[data-day]").forEach(el => el.addEventListener("click", () => {
        S.date = el.dataset.day; S.time = "";
        days.querySelectorAll("[data-day]").forEach(x => x.classList.toggle("on", x === el));
        foot(f, true, next, "다음", false);
      }));
      if(!monthCache[ym]){
        days.classList.add("loading");
        monthCache[ym] = await RES_API.month(ym, total(), S.seat || "any");
        days.classList.remove("loading");
      }
      const m = monthCache[ym];
      days.querySelectorAll("[data-day]").forEach(el => {
        if(!el.disabled && m[el.dataset.day] === 0){
          el.disabled = true;
          el.setAttribute("aria-label", el.getAttribute("aria-label") + " 예약 불가");
        }
      });
      if(S.date && m[S.date] === 0){ S.date = ""; foot(f, true, next, "다음", true); }
    }
    function next(){ if(S.date){ step = 3; render(); } }
    foot(f, true, next, "다음", !S.date);
    draw();
  }

  /* ---------- ③ 시간 ---------- */
  function sTime(b, f){
    b.insertAdjacentHTML("beforeend", sumLine() + `<section class="rv-sec"><h3>시간</h3><div id="rv-times"><p class="rv-quiet">불러오는 중…</p></div></section>`);
    const times = $("#rv-times", b);
    foot(f, true, next, "다음", true);
    (async () => {
      const want = S.date;
      const list = await RES_API.slots(S.date, total(), S.seat || "any");
      if(!ov || want !== S.date) return;
      if(!list.length){ times.innerHTML = `<p class="rv-quiet">이 날은 예약 가능한 시간이 없습니다. 다른 날짜를 고르시거나 유선으로 문의해 주세요. <a href="tel:${INFO.tel}">${esc(INFO.tel)}</a></p>`; return; }
      const lunch = list.filter(t => mins(t) < LUNCH_END), dinner = list.filter(t => mins(t) >= LUNCH_END);
      const grid = (label, arr) => arr.length ? `<div class="rv-tgroup"><span>${label}</span><div class="rv-times">${
        arr.map(t => `<button type="button" data-t="${t}" class="${t===S.time?'on':''}">${hm(t)}</button>`).join("")}</div></div>` : "";
      times.innerHTML = grid("점심", lunch) + grid("저녁", dinner);
      times.querySelectorAll("[data-t]").forEach(el => el.addEventListener("click", () => {
        if(S.time !== el.dataset.t){ S.course = ""; S.courseLabel = ""; }
        S.time = el.dataset.t;
        times.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("on", x === el));
        foot(f, true, next, "다음", false);
      }));
      foot(f, true, next, "다음", !S.time);
    })();
    function next(){ if(S.time){ startTimer(); step = 4; render(); } }
  }

  /* ---------- ④ 좌석 ---------- */
  function sSeat(b, f){
    b.insertAdjacentHTML("beforeend", sumLine() + `<section class="rv-sec">
        <h3>좌석</h3>
        <div class="rv-pick two" id="rv-seat">
          <button type="button" data-s="table" class="${S.seat==='table'?'on':''}"><b>테이블</b></button>
          <button type="button" data-s="room" class="${S.seat==='room'?'on':''}"><b>룸</b></button>
        </div>
        <div id="rv-seat-hint"></div>
      </section>`);
    const seg = $("#rv-seat", b), hint = $("#rv-seat-hint", b);
    /* 시간표는 '룸이든 테이블이든' 되는 시각이라, 고른 시각에 못 받는 좌석은 여기서 막고 유선으로 돌립니다 —
       접수된 뒤에야 "테이블 없음" 이 뜨면 매장도 손님도 곤란함(재아 2026-09-17) */
    const okBy = {};
    async function load(){
      for(const k of ["table", "room"]) okBy[k] = await RES_API.seatOk(S.date, S.time, total(), k);
      if(!ov || step !== 4) return;
      seg.querySelectorAll("[data-s]").forEach(x => { x.disabled = !okBy[x.dataset.s]; x.classList.toggle("off", !okBy[x.dataset.s]); });
      draw();
    }
    function draw(){
      seg.querySelectorAll("[data-s]").forEach(x => x.classList.toggle("on", x.dataset.s === S.seat));
      const label = S.seat === "room" ? "룸" : "테이블";
      const po = !S.seat ? "" : (okBy[S.seat] === false ? `이 시각에는 ${label} 자리가 없습니다. 유선으로 예약 도와드리겠습니다.` : phoneOnly());
      const off = ["table", "room"].filter(k => okBy[k] === false).map(k => k === "room" ? "룸" : "테이블");
      hint.innerHTML = off.length ? `<p class="rv-quiet">${esc(off.join("·"))}은 이 시각에 자리가 없어 고를 수 없습니다.</p>` : "";
      foot(f, true, next, "다음", !S.seat || !!po, po ? `${esc(po)} <a href="tel:${INFO.tel}">${esc(INFO.tel)}</a>` : "");
    }
    seg.querySelectorAll("[data-s]").forEach(x => x.addEventListener("click", () => {
      if(S.seat !== x.dataset.s){ S.seat = x.dataset.s; S.course = ""; S.courseLabel = ""; }
      draw();
    }));
    function next(){ if(S.seat && okBy[S.seat] !== false && !phoneOnly()){ step = 5; render(); } }
    draw(); load();
  }

  /* ---------- ⑤ 메뉴 — 점심 시각이면 그 날(평일·주말)의 점심 세트도 함께 ---------- */
  /* 저녁 코스는 종일 되니 늘 먼저(비싼 것부터 — 재아), 점심 시각이면 그 아래 점심 세트 */
  /* 특별 기간(명절 등, 홈페이지 관리 → 홈페이지 예약 → 특별 기간 차림): 그 날짜면 그 코스만 */
  function specialOf(date){ return (R().special || []).find(sp => sp && sp.from && sp.to && date >= sp.from && date <= sp.to && (sp.courses || []).length) || null; }
  /* 잠근 특별 기간(방침·차림이 정해지기 전, 홈페이지 관리에서 '잠금') — 그 날짜는 온라인으로 안 받고 전화 안내 */
  /* 특별 기간의 날짜는 '홈페이지 예약 활성화' 가 켜져 있고 오늘이 '예약 받는 기간' 안일 때만 고를 수 있음(09-24 재아). 옛 저장본은 lock(잠금)만 있음 */
  function spOpenNow(sp){
    const on = sp.open != null ? !!sp.open : !sp.lock;
    if(!on) return false;
    const t = ymd(new Date());
    return (!sp.openFrom || t >= sp.openFrom) && (!sp.openTo || t <= sp.openTo);
  }
  function lockedOf(date){ return (R().special || []).find(sp => sp && sp.from && sp.to && date >= sp.from && date <= sp.to && !spOpenNow(sp)) || null; }
  function menuGroups(){
    const sp = specialOf(S.date);
    if(sp) return [{ title: sp.title || "특별 코스", note: sp.note || "", items: sp.courses.map(x => { const m = String(x).split("|"); const name = m[0].trim(); return {key:"course:"+name, name, cn:(m[1]||"").trim()}; }) }];
    const out = [{ title: "저녁 코스 · 종일 주문 가능", items: MENU.courses.items.map(c => ({key:"course:"+c.name, name:c.name, cn:c.cn})) }];
    if(mins(S.time) < LUNCH_END){
      const want = isWeekend(S.date) ? "주말" : "평일";
      const set = MENU.lunch.filter(g => g.title.indexOf(want) === 0)[0] || MENU.lunch[0];
      out.push({ title: set.title, items: set.items.map(x => ({key:"set:"+x.name, name:x.name, cn:""})) });
    }
    return out;
  }
  function sMenu(b, f){
    const room = S.seat === "room";
    b.insertAdjacentHTML("beforeend", sumLine() + `<section class="rv-sec">
        <h3>메뉴</h3>
        <div class="rv-pick" id="rv-cs">
          ${menuGroups().map(g => `<div class="rv-pick-h">${esc(g.title)}${g.note ? `<small>${esc(g.note)}</small>` : ""}</div>` + g.items.map(it =>
              `<button type="button" data-c="${esc(it.key)}" data-l="${esc(it.name)}" class="${S.course===it.key?'on':''}"><b>${esc(it.name)}${it.cn?`<small>${esc(it.cn)}</small>`:""}</b><span class="qty">${total()}인분</span></button>`).join("")).join("")}
          ${specialOf(S.date) ? "" : `<div class="rv-pick-h"></div>
          ${room ? `<button type="button" data-c="later" data-l="메뉴 미정" class="${S.course==='later'?'on':''}"><b>미정</b></button>`
                 : `<button type="button" data-c="none" data-l="단품 주문" class="${S.course==='none'?'on':''}"><b>단품 주문</b></button>`}`}
        </div>
        <p class="rv-quiet"><a href="${INFO.menuPdf}" target="_blank" rel="noopener">메뉴판(PDF) 보기</a></p>
      </section>`);
    b.querySelectorAll("[data-c]").forEach(el => el.addEventListener("click", () => {
      S.course = el.dataset.c; S.courseLabel = el.dataset.l;
      b.querySelectorAll("[data-c]").forEach(x => x.classList.toggle("on", x === el));
      foot(f, true, next, "다음", false);
    }));
    function go(){ step = 6; render(); }
    function next(){
      if(!S.course) return;
      if(room && S.course === "later") ask("룸 이용 안내", "룸에서는 <b>코스</b>, 또는 그에 상응하는 금액의 단품 주문만 가능합니다.", "확인", go);
      else go();
    }
    foot(f, true, next, "다음", !S.course);
  }

  /* ---------- ⑥ 예약자 정보 ---------- */
  function sGuest(b, f){
    b.insertAdjacentHTML("beforeend", sumLine() + `<section class="rv-sec">
        <h3>예약자 정보</h3>
        <div class="rv-fld"><label for="rv-name">성함</label><input id="rv-name" value="${esc(S.name)}" placeholder="성함을 입력해 주세요" autocomplete="name" maxlength="30"></div>
        <div class="rv-fld">
          <label for="rv-phone">전화번호</label>
          <div class="rv-inline">
            <input id="rv-phone" type="tel" value="${esc(S.phone)}" placeholder="전화번호를 입력해 주세요" autocomplete="tel" inputmode="numeric"${S.verified?" disabled":""}>
            <button type="button" class="btn" id="rv-send"${S.verified?" disabled":""}>${S.verified ? "인증 완료" : "인증번호 요청"}</button>
          </div>
          <div class="rv-inline" id="rv-codebox"${S.sent && !S.verified ? "" : " hidden"}>
            <input id="rv-code" inputmode="numeric" maxlength="6" placeholder="인증번호 6자리">
            <button type="button" class="btn" id="rv-verify">확인</button>
          </div>
          <p class="rv-fld-hint" id="rv-tel-hint">${S.verified ? "인증되었습니다." : ""}</p>
          <button type="button" class="rv-linkbtn" id="rv-tel-edit"${S.sent && !S.verified ? "" : " hidden"}>번호 수정</button>
        </div>
        <div class="rv-fld"><label for="rv-req">요청사항 <em>선택</em></label>
          <textarea id="rv-req" rows="3" maxlength="300" placeholder="알레르기, 유아용 의자, 기념일 등 요청하실 내용이 있다면 적어 주세요.">${esc(S.req)}</textarea></div>
      </section>`);
    const name = $("#rv-name", b), phone = $("#rv-phone", b), send = $("#rv-send", b),
          codebox = $("#rv-codebox", b), code = $("#rv-code", b), verify = $("#rv-verify", b), hint = $("#rv-tel-hint", b), req = $("#rv-req", b), edit = $("#rv-tel-edit", b);
    if(S.sent && !S.verified) phone.disabled = true;
    edit.addEventListener("click", () => {
      S.sent = false; S.resendUsed = false; phone.disabled = false; edit.hidden = true; codebox.hidden = true; send.disabled = false; send.textContent = "인증번호 요청";
      clearInterval(codeTimer); codeTimer = null; hint.textContent = ""; hint.classList.remove("bad"); phone.focus();
    });
    let codeTimer = null, codeLeft = 0, resendLeft = 0;
    const codeTick = () => {
      if(codeLeft <= 0){ clearInterval(codeTimer); codeTimer = null; verify.disabled = true; hint.textContent = "인증번호가 만료되었습니다. 다시 요청해 주세요."; hint.classList.add("bad"); return; }
      hint.textContent = `문자로 보낸 인증번호를 입력해 주세요. (${pad(Math.floor(codeLeft/60))}:${pad(codeLeft%60)})`; codeLeft--;
      /* 재요청은 성급한 중복 발송을 막되, 한 번은 받을 수 있게 1분 뒤에만 엽니다 */
      if(S.sent && !S.resendUsed && resendLeft > 0){ send.disabled = true; send.textContent = `다시 요청 (${resendLeft}초)`; resendLeft--; }
      else if(S.sent && !S.resendUsed){ send.disabled = false; send.textContent = "다시 요청"; }
    };
    const ok = () => S.name.trim().length >= 2 && S.verified;
    const refoot = () => foot(f, true, next, "다음", !ok());
    name.addEventListener("input", () => { S.name = name.value; refoot(); });
    req.addEventListener("input", () => { S.req = req.value; });
    phone.addEventListener("input", () => {
      const d = phone.value.replace(/\D/g, "").slice(0, 11);
      phone.value = d.length > 7 ? d.replace(/(\d{3})(\d{3,4})(\d{0,4})/, "$1-$2-$3") : d.length > 3 ? d.replace(/(\d{3})(\d{0,4})/, "$1-$2") : d;
      S.phone = phone.value;
    });
    send.addEventListener("click", () => {
      const d = S.phone.replace(/\D/g, "");
      if(!/^01\d{8,9}$/.test(d)){ hint.textContent = "휴대폰 번호를 확인해 주세요."; hint.classList.add("bad"); return; }
      /* 실제로는 여기서 문자를 보냅니다. 보낸 뒤에는 번호를 못 바꾸게 잠급니다(바꾸려면 '번호 수정') — 인증한 번호와 적힌 번호가 달라지는 것을 막음(재아) */
      const resend = S.sent;
      if(resend){
        if(S.resendUsed || resendLeft > 0) return;
        S.resendUsed = true; codeLeft += 60; send.disabled = true; send.textContent = "다시 요청 완료";
      }else{
        S.sent = true; codeLeft = CODE_SEC; resendLeft = RESEND_WAIT_SEC; send.disabled = true;
      }
      codebox.hidden = false; verify.disabled = false; code.value = "";
      phone.disabled = true; edit.hidden = false;
      hint.classList.remove("bad"); clearInterval(codeTimer); codeTick(); codeTimer = setInterval(codeTick, 1000);
      code.focus();
    });
    verify.addEventListener("click", () => {
      if(!/^\d{6}$/.test(code.value)){ hint.textContent = "6자리 숫자를 입력해 주세요."; hint.classList.add("bad"); return; }
      clearInterval(codeTimer); codeTimer = null;
      S.verified = true; codebox.hidden = true; phone.disabled = true; send.disabled = true; send.textContent = "인증 완료"; edit.hidden = true;
      hint.classList.remove("bad"); hint.textContent = "인증되었습니다."; refoot();
    });
    function next(){ if(ok()){ step = 7; render(); } }
    refoot();
  }

  /* ---------- ⑦ 예약 확인 ---------- */
  function sConfirm(b, f){
    const rows = [
      ["날짜", dateText(S.date)], ["시간", hm(S.time)],
      ["인원", S.kids ? `성인 ${S.adults}명 · 어린이 ${S.kids}명` : `성인 ${S.adults}명`],
      ["좌석", S.seat === "room" ? "룸" : "테이블"],
      ["메뉴", S.course === "later" ? "미정" : (S.course === "none" ? "단품 주문" : `${S.courseLabel} · ${total()}인분`)],
      ["예약자", S.name.trim()+" · "+S.phone]
    ];
    if(S.req.trim()) rows.push(["요청사항", S.req.trim()]);
    /* body 가 없으면(만 14세) 펼치기 없이 제목만 — 펼쳐 봐야 할 말이 없음(재아) */
    const box = (key, title, body) => `<div class="rv-agree${S.agree[key]?" on":""}${body?"":" plain"}">
        <div class="rv-agree-h">
          <label class="rv-chk"><input type="checkbox" id="rv-a-${key}" data-a="${key}"${S.agree[key]?" checked":""}><i></i></label>
          ${body ? `<button type="button" class="rv-agree-t"><b>[필수] ${title}</b><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>`
                 : `<label class="rv-agree-t" for="rv-a-${key}"><b>[필수] ${title}</b></label>`}
        </div>
        ${body ? `<div class="body">${body}</div>` : ""}</div>`;
    b.insertAdjacentHTML("beforeend", `<section class="rv-sec">
        <h3>예약 확인</h3>
        <dl class="rv-check">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      </section>
      <section class="rv-sec">
        ${box("rule", "매장 이용규정에 동의합니다", `<ul>
            <li>접수 후 매장에서 확인 후 확정 여부를 문자로 전송드립니다.</li>
            <li>룸에서는 코스 및 세트, 또는 그에 상응하는 금액의 단품 주문만 가능합니다.</li>
            <li>룸은 매장 상황에 맞춰 배정합니다.</li>
            <li>예약 시각 20분 내로 방문이 되지 않을 경우 예약이 취소되며 No-Show로 처리됩니다.</li>
            <li>인원 변동이 생기면 매장으로 유선 연락 바랍니다.</li>
            <li>예약 변경 및 취소는 매장으로 유선 연락 바랍니다.</li></ul>`)}
        ${box("priv", "개인정보 수집 · 이용에 동의합니다", `<table>
            <tr><th>항목</th><th>목적</th><th>보유 기간</th></tr>
            <tr><td>성함, 휴대폰 번호</td><td>예약 확인·안내 문자 발송, 예약 관리</td><td>삭제를 요청하실 때까지</td></tr>
            <tr><td>알레르기, 요청사항</td><td>좌석과 식사 준비</td><td>삭제를 요청하실 때까지</td></tr></table>`)}
        ${box("age", "만 14세 이상입니다", "")}
      </section>`);
    b.querySelectorAll("[data-a]").forEach(c => c.addEventListener("change", () => {
      S.agree[c.dataset.a] = c.checked; c.closest(".rv-agree").classList.toggle("on", c.checked); refoot();
    }));
    b.querySelectorAll(".rv-agree-t").forEach(t => t.addEventListener("click", () => t.closest(".rv-agree").classList.toggle("open")));
    const all = () => S.agree.rule && S.agree.priv && S.agree.age;
    const refoot = () => foot(f, true, submit, "접수하기", !all());
    async function submit(){
      if(!all()) return;
      const btn = $("[data-next]", f); btn.disabled = true; btn.textContent = "접수 중…";
      const r = await RES_API.submit({date:S.date, time:S.time, adults:S.adults, kids:S.kids, people:total(),
                                      seat:S.seat, course:S.course, courseLabel:S.courseLabel,
                                      name:S.name.trim(), phone:S.phone, request:S.req.trim(), allergy:S.allergy.trim()});
      if(r && r.ok){ S.reqId = r.id || ""; clearInterval(timer); timer = null; step = 8; render(); }
      else { btn.disabled = false; btn.textContent = "접수하기"; render((r && r.msg) || "접수가 되지 않았습니다. 잠시 뒤 다시 시도하시거나 전화로 문의해 주세요."); }
    }
    refoot();
  }

  /* 예약번호 — 예약 시스템(03-util resCode)과 같은 계산. 접수 번호(rq_…)와 시스템이 만든 예약(res_…)이 같은 8자리가 됩니다 */
  function resCode(id){
    let s = String(id || "").replace(/^(res|rq)_/, ""), h = 2166136261;
    for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 2654435761) >>> 0;
    return String(h % 100000000).padStart(8, "0");
  }
  /* ---------- 접수 완료 ---------- */
  function done(b, f){
    $(".rv-timer", ov).hidden = true;
    b.innerHTML = `<div class="rv-done">
        <div class="rv-tick"><svg viewBox="0 0 48 48"><path d="M14 25l7 7 14-15"/></svg></div>
        <h3>접수되었습니다</h3>
        <p class="big">${esc(dateText(S.date))} ${esc(hm(S.time))} · ${esc(peopleText())} · ${S.seat==="room"?"룸":"테이블"}</p>
        ${S.reqId ? `<p class="rv-code">예약번호 <b class="num">${resCode(S.reqId)}</b></p>` : ""}
        <p>확인 후 <b>${esc(S.phone)}</b> 로 예약 확정 문자를 보내드립니다.</p>
        <p class="rv-quiet">예약 변경 혹은 다른 문의사항은 <a href="tel:${INFO.tel}">${esc(INFO.tel)}</a> 로 전화 주세요.</p>
      </div>`;
    f.innerHTML = `<span></span><button type="button" class="btn fill" data-close>닫기</button>`;
    $("[data-close]", f).addEventListener("click", close);
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-reserve]"); if(!t) return;
    e.preventDefault(); open();
  });
  window.openReserve = open;

  /* 미리보기: ?rv=5 처럼 붙이면 그 단계가 보기 데이터로 열립니다(스크린샷·검토용) */
  const m = location.search.match(/[?&]rv=(\d)/);
  if(m){
    open();
    const d = new Date(Date.now() + 3*864e5);
    Object.assign(S, {date:ymd(d), time:"12:30", adults:5, kids:1, seat:"room", course:"course:촉 코스", courseLabel:"촉 코스",
                      name:"홍길동", phone:"010-1234-5678", sent:true, verified:true});
    step = Number(m[1]);
    if(step === 1){ S.adults = 1; S.kids = 0; }
    if(step > 3) startTimer();
    render();
  }
})();
