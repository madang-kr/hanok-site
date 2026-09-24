/* 홈페이지 ↔ 예약 시스템 연결 정보. anon 키는 공개해도 되는 키입니다(서버 권한표가 막음) —
   홈페이지가 할 수 있는 건 남은 자리 읽기와 접수 한 줄 넣기뿐. service_role 키는 절대 여기 넣지 않습니다.
   2026-09-24 부터 실서비스 프로젝트(madang-hanok, 가게 계정) — system/supabase.prod.json 과 같은 값. store 는 매장 키 */
window.SUPA = { url: "https://jgjrpzjbvptgvrgreibe.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnanJwempidnB0Z3ZyZ3JlaWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzAyOTIsImV4cCI6MjEwNTgwNjI5Mn0.becT9mKoEB9A4WJlxWpV_kpVI3RAQilLytaibqrUfPA", store: "hanok" };
