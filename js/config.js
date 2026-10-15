/* 홈페이지 ↔ 예약 시스템 연결 정보. anon 키는 공개해도 되는 키입니다(서버 권한표가 막음) —
   홈페이지가 할 수 있는 건 남은 자리 읽기와 접수 한 줄 넣기뿐. service_role 키는 절대 여기 넣지 않습니다.
   2026-09-24 부터 실서비스 프로젝트(madang-hanok, 가게 계정) — manage/supabase.prod.json 과 같은 값. store 는 매장 키 */
/* 10-15: 이 PC(127.0.0.1·localhost)에서 열면 개발 서버(madang-hanok-dev) — 실서비스 자료를 건드리지 않고 고쳐 보려고. 그 밖의 주소는 실서비스 그대로 */
window.SUPA = /^(127\.0\.0\.1|localhost)$/.test(location.hostname)
  ? { url: "https://bmarjrjasgyxgxejdtvv.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtYXJqcmphc2d5eGd4ZWpkdHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNTUxMDgsImV4cCI6MjEwNzYzMTEwOH0.wfgsKWYb9V6XsPdW_LyqAIpYE_9WD4pA3q2ojYTQKcI", store: "hanok", dev: true }
  : { url: "https://jgjrpzjbvptgvrgreibe.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnanJwempidnB0Z3ZyZ3JlaWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzAyOTIsImV4cCI6MjEwNTgwNjI5Mn0.becT9mKoEB9A4WJlxWpV_kpVI3RAQilLytaibqrUfPA", store: "hanok" };
