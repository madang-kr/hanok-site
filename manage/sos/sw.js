/* SOS 비상 페이지를 기기에 저장해 두는 서비스 워커(2026-09-29 재아: 인터넷이 완전히 끊겨도 열리게).
   범위는 /manage/sos/ 뿐 — 예약 시스템·홈페이지는 건드리지 않음.
   인터넷이 되면 늘 새로 받고(그리고 저장), 안 되면 저장해 둔 것을 씀. 페이지를 고치면 VER 을 올림 */
var VER = "sos-v2";
var FILES = ["./", "./index.html", "/favicon.ico?v=2"];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(VER).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k !== VER && k.indexOf("sos-") === 0; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function(r){
    var copy = r.clone(); caches.open(VER).then(function(c){ c.put(e.request, copy); }); return r;
  }).catch(function(){
    return caches.match(e.request, { ignoreSearch:true }).then(function(m){ return m || caches.match("./index.html"); });
  }));
});
