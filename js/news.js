/* 소식 장 — 서버 site_posts 표에서 '게시' 글을 읽습니다(고정 글이 맨 위, 그 다음 최신순).
   글은 예약 시스템 → 사장님 → 홈페이지 관리 → 소식 에서 쓰고, 저장하면 바로 여기 나옵니다(초안·적용 단계 없음).

   두 화면을 같은 파일이 그립니다(재아 09-20: 펼치기 대신 글마다 제 페이지):
   · news.html          목록 — 제목·날짜·첫 줄. 누르면 아래 글 페이지로(같은 창에서 이어서)
                        한 쪽에 PER(10)개, 넘으면 아래 1 2 3 쪽 번호(09-24 재아: 무한 스크롤 말고 쪽 나누기). news.html?page=2
   · news.html?p=글번호  글 한 편 — 본문·사진·첨부 + 이전 글 / 다음 글 / 목록
   옛 주소 #post_… 로 들어오면 ?p= 로 바꿔 줍니다(예전에 보낸 링크가 살아 있게).

   글 목록은 한 번 받으면 sessionStorage 에 두고 다음 화면에서 먼저 씁니다 — 목록 ↔ 글 사이를 오갈 때 '불러오는 중' 이 안 보이게.
   서버가 없거나(js/config.js 없음) 실패하면 "아직 소식이 없습니다" 만 — 손님에게 오류 문장을 보이지 않습니다. */
(function(){
  const box = document.getElementById("news"); if(!box) return;
  const esc = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const WD = ["일","월","화","수","목","금","토"];
  const dateText = d => { const t = new Date(d + "T00:00:00"); return isNaN(t) ? d : `${t.getFullYear()}. ${t.getMonth()+1}. ${t.getDate()} (${WD[t.getDay()]})`; };
  const empty = () => { box.innerHTML = `<p class="news-empty">아직 올린 소식이 없습니다.</p>`; };
  const CACHE = "hanok-news-rows";

  /* 옛 깊은 링크(#post_…) → 새 주소(?p=…) */
  if(location.hash && location.hash.length > 1 && !/[?&]p=/.test(location.search)){
    location.replace("news.html?p=" + encodeURIComponent(location.hash.slice(1))); return;
  }
  const Q = new URLSearchParams(location.search);
  const want = (Q.get("p") || "").trim();
  const PER = 10;                                                     /* 한 쪽에 글 10개 */
  const pageOf = i => Math.floor(i / PER) + 1;
  const listUrl = n => n > 1 ? "news.html?page=" + n : "news.html";

  const metaHtml = p => `<span class="post-meta">${p.pinned ? `<em>고정</em>` : ""}<time datetime="${esc(p.date)}">${esc(dateText(p.date))}</time></span>`;

  /* 목록 — 제목·날짜·첫 줄. 글 하나가 링크 하나 */
  const renderList = rows => {
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    const cur = Math.min(pages, Math.max(1, parseInt(Q.get("page"), 10) || 1));
    box.className = "news";
    box.innerHTML = rows.slice((cur - 1) * PER, cur * PER).map(p => {
      const first = String(p.body || "").split(/\n{2,}/).map(x => x.trim()).filter(Boolean)[0];
      const line = (first || "").split("\n")[0];
      /* 사진이 있으면 오른쪽에 첫 장 작게, 여러 장이면 위에 겹친 네모 표시(09-24 재아) */
      const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      const th = imgs.length ? `<span class="post-th"><img src="${esc(imgs[0])}" alt="" loading="lazy" onerror="this.parentNode.remove()">${imgs.length > 1 ? `<i class="many" aria-label="사진 ${imgs.length}장"><svg viewBox="0 0 16 16"><rect x="4.5" y="1.5" width="10" height="10" rx="1.5"/><path d="M11.5 14.5h-8.5a1.5 1.5 0 0 1-1.5-1.5v-8.5"/></svg></i>` : ""}</span>` : "";
      return `<a class="post-l${th ? " has-th" : ""}" href="news.html?p=${encodeURIComponent(p.id)}">
          <span class="post-lt">
            ${metaHtml(p)}
            <h2>${esc(p.title)}</h2>
            ${line ? `<p class="post-first">${rich(line)}</p>` : ""}
          </span>
          ${th}
          <i class="post-arrow"></i>
        </a>`;
    }).join("") + (pages > 1 ? pagerHtml(cur, pages) : "");
  };
  /* 쪽 번호 — 앞뒤 ‹ ›, 번호는 지금 쪽 둘레 다섯 개까지(글이 아주 많아져도 한 줄) */
  const pagerHtml = (cur, pages) => {
    let a = Math.max(1, cur - 2), b = Math.min(pages, a + 4); a = Math.max(1, b - 4);
    const nums = []; for(let n = a; n <= b; n++) nums.push(n === cur ? `<span class="on" aria-current="page">${n}</span>` : `<a href="${listUrl(n)}">${n}</a>`);
    return `<nav class="pager" aria-label="쪽">
        ${cur > 1 ? `<a class="pg-arrow" href="${listUrl(cur - 1)}" aria-label="앞 쪽">‹</a>` : `<span class="pg-arrow off">‹</span>`}
        ${nums.join("")}
        ${cur < pages ? `<a class="pg-arrow" href="${listUrl(cur + 1)}" aria-label="다음 쪽">›</a>` : `<span class="pg-arrow off">›</span>`}
      </nav>`;
  };

  /* 글 한 편 — 본문·사진·첨부 + 이전/다음. 이전 글 = 목록에서 아래(더 오래된) 글, 다음 글 = 위(더 새) 글 */
  const renderPost = (rows, i) => {
    const p = rows[i], older = rows[i + 1], newer = rows[i - 1];
    const paras = String(p.body || "").split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
    const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const files = Array.isArray(p.files) ? p.files.filter(f => f && f.url) : [];
    document.title = `${p.title} — 한옥반점`;
    box.className = "news one";
    box.innerHTML = `<article class="post-v" id="${esc(p.id)}">
        <header class="post-vh">${metaHtml(p)}<h2>${esc(p.title)}</h2></header>
        <div class="post-text">${paras.map(x => `<p>${rich(x).replace(/\n/g, "<br>")}</p>`).join("")}</div>
        ${imgs.length ? `<div class="post-imgs">${imgRows(imgs).map(row => `<div class="post-row">${row.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></a>`).join("")}</div>`).join("")}</div>` : ""}
        ${files.length ? `<ul class="post-files">${files.map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener" download>${esc(f.name || f.url.split("/").pop())}</a></li>`).join("")}</ul>` : ""}
      </article>
      <nav class="post-nav">
        ${newer ? `<a class="nx" href="news.html?p=${encodeURIComponent(newer.id)}"><small>다음 글</small><span>${esc(newer.title)}</span></a>` : `<span class="nx off"><small>다음 글</small><span>다음 글이 없습니다</span></span>`}
        ${older ? `<a class="pv" href="news.html?p=${encodeURIComponent(older.id)}"><small>이전 글</small><span>${esc(older.title)}</span></a>` : `<span class="pv off"><small>이전 글</small><span>이전 글이 없습니다</span></span>`}
        <a class="all" href="${listUrl(pageOf(i))}">목록</a>
      </nav>`;
    fitRows(box);
    /* 사진 크게 보기 — 새 탭 대신 화면 위 덮개. ‹ › 로 넘기고, 바깥·Esc 로 닫힘 */
    box.querySelectorAll(".post-imgs a").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      const all = [...box.querySelectorAll(".post-imgs a")].map(x => x.href); let i = all.indexOf(a.href);
      const lb = document.createElement("div"); lb.className = "lb";
      lb.innerHTML = `<img alt="">${all.length > 1 ? `<button type="button" class="lb-nav prev" aria-label="이전">‹</button><button type="button" class="lb-nav next" aria-label="다음">›</button>` : ""}<button type="button" class="lb-x" aria-label="닫기">×</button><span class="lb-n"></span>`;
      const show = () => { lb.querySelector("img").src = all[i]; lb.querySelector(".lb-n").textContent = all.length > 1 ? `${i + 1} / ${all.length}` : ""; };
      const close = () => { lb.remove(); document.removeEventListener("keydown", key); document.body.classList.remove("lb-open"); };
      const key = ev => { if(ev.key === "Escape") close(); else if(ev.key === "ArrowLeft"){ i = (i + all.length - 1) % all.length; show(); } else if(ev.key === "ArrowRight"){ i = (i + 1) % all.length; show(); } };
      lb.addEventListener("click", ev => { const t = ev.target; if(t.classList.contains("prev")){ i = (i + all.length - 1) % all.length; show(); } else if(t.classList.contains("next")){ i = (i + 1) % all.length; show(); } else close(); });   /* 사진·바깥·× 어디를 눌러도 닫힘 */
      document.addEventListener("keydown", key); document.body.classList.add("lb-open"); document.body.append(lb); show();
    }));
    window.scrollTo(0, 0);
  };

  /* 사진 줄 나누기 — 한 줄 최대 3장. 4장이면 2+2, 5장이면 3+2 처럼 고르게(마지막에 한 장만 크게 남지 않게) */
  const imgRows = imgs => {
    const n = imgs.length, lines = Math.ceil(n / 3), out = []; let k = 0;
    for(let r = 0; r < lines; r++){ const take = Math.ceil((n - k) / (lines - r)); out.push(imgs.slice(k, k + take)); k += take; }
    return out;
  };
  /* 줄 안의 사진 높이를 같게: 사진마다 flex-grow = 가로/세로 비율 → 너비가 비율대로 나뉘어 잘리는 곳이 없음(09-24 재아 '잘려서 아쉬움') */
  const fitRows = root => root.querySelectorAll(".post-row img").forEach(img => {
    const set = () => { if(img.naturalWidth && img.naturalHeight){ const r = img.naturalWidth / img.naturalHeight; img.parentNode.style.flex = r + " 1 0"; img.parentNode.style.aspectRatio = r; } };
    if(img.complete) set(); else img.addEventListener("load", set);
  });

  const draw = rows => {
    if(!rows.length){ empty(); return; }
    if(want){
      const i = rows.findIndex(p => p.id === want);
      if(i < 0){ box.className = "news one"; box.innerHTML = `<p class="news-empty">그 글은 내려갔거나 없습니다.</p><nav class="post-nav"><a class="all" href="news.html">목록</a></nav>`; return; }
      renderPost(rows, i);
    } else renderList(rows);
  };

  const C = window.SUPA;
  if(!C || !C.url || !C.anonKey){ empty(); return; }
  let cached = null; try{ cached = JSON.parse(sessionStorage.getItem(CACHE) || "null"); }catch(e){}
  if(cached && Array.isArray(cached.rows)) draw(cached.rows);
  const H = { "apikey": C.anonKey, "Authorization": "Bearer " + C.anonKey };
  fetch(`${C.url}/rest/v1/site_posts?store=eq.${C.store}&status=eq.%EA%B2%8C%EC%8B%9C&select=id,title,body,date,images,files,pinned&order=pinned.desc,date.desc,created_at.desc&limit=200`, {headers:H})
    .then(r => r.ok ? r.json() : [])
    .then(rows => {
      const same = cached && JSON.stringify(cached.rows) === JSON.stringify(rows);
      try{ sessionStorage.setItem(CACHE, JSON.stringify({rows})); }catch(e){}
      if(!same) draw(rows);
    })
    .catch(() => { if(!cached) empty(); });
})();
