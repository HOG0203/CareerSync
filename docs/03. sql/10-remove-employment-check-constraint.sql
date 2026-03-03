-- [취업구분 제약 조건 완전 제거]
-- UI에서 드롭다운으로 관리가 가능하므로, 데이터베이스의 CHECK 제약 조건을 삭제하여 유연성을 확보합니다.

ALTER TABLE public.student_employments 
DROP CONSTRAINT IF EXISTS student_employments_employment_status_check;

-- 추가로 기업구분, 사업구분 등 유사한 필드가 있다면 텍스트 형식으로 자유롭게 저장되도록 보장합니다.
