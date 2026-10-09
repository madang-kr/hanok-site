/* 옛 주소(/system/sos/)에 등록돼 있던 서비스 워커를 치우는 파일 — 2026-10-03 주소가 /manage/ 로 바뀜.
   이 파일을 받은 기기는 스스로 등록을 풀고 캐시를 지웁니다. 새 비상 페이지는 /manage/sos/ */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){
  e.waitUntil(
    /* 옛 판(sos-v1~v7)만 — 저장소는 사이트 전체가 같이 써서, 전엔 새 비상 페이지(/manage/sos/)의 저장본까지 지웠음(10-09 점검) */
    caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return /^sos-v[1-7]$/.test(k); }).map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.registration.unregister(); })
  );
});
