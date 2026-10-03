/* 옛 주소(/system/sos/)에 등록돼 있던 서비스 워커를 치우는 파일 — 2026-10-03 주소가 /manage/ 로 바뀜.
   이 파일을 받은 기기는 스스로 등록을 풀고 캐시를 지웁니다. 새 비상 페이지는 /manage/sos/ */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.registration.unregister(); })
  );
});
