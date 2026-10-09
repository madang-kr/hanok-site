/* SOS 비상 페이지를 기기에 저장해 두는 서비스 워커(2026-09-29 재아: 인터넷이 완전히 끊겨도 열리게).
   범위는 /manage/sos/ 뿐 — 예약 시스템·홈페이지는 건드리지 않음.
   인터넷이 되면 늘 새로 받고(그리고 저장), 안 되면 저장해 둔 것을 씀. 페이지를 고치면 VER 을 올림 */
var VER = "sos-v9";   /* 10-09 점검: 오류 답은 저장 안 함 · 4초 넘게 답이 없으면 저장본 · 검색 한글 조합 · 여러 파일 겹침 */   /* 10-09 열람만 · 서버 상태 · 새 디자인 · 예약 상세 · 딱지·모든 날짜 검색 */
var FILES = ["./", "./index.html", "/favicon.ico?v=2", "/js/config.js", "/fonts/Pretendard-Regular.woff2", "/fonts/Pretendard-SemiBold.woff2", "/fonts/Pretendard-Bold.woff2"];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(VER).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k !== VER && k.indexOf("sos-") === 0; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  /* 다른 주소(예약 서버의 상태 확인)는 저장하지 않음 — 저장해 두면 서버가 죽어도 '정상' 답이 나왔음(10-09) */
  if(new URL(e.request.url).origin !== self.location.origin) return;
  var fromCache = function(){ return caches.match(e.request, { ignoreSearch:true }).then(function(m){ return m || caches.match("./index.html"); }); };
  /* 연결은 됐는데 답이 안 오는 망에서 오래 멈추지 않게 4초 */
  var timed = new Promise(function(ok, no){ setTimeout(function(){ no(new Error("timeout")); }, 4000); });
  e.respondWith(Promise.race([fetch(e.request), timed]).then(function(r){
    if(!r || !r.ok) return fromCache().then(function(m){ return m || r; });   /* 404·5xx(배포 중 등)는 저장본을 덮지 않고, 저장본이 있으면 그것을 */
    var copy = r.clone(); caches.open(VER).then(function(c){ c.put(e.request, copy); }); return r;
  }).catch(fromCache));
});
