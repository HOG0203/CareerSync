-- 1. students 테이블에 신규 개인 신상 정보 컬럼 추가
ALTER TABLE students ADD COLUMN IF NOT EXISTS military_status TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_work_area TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parents_opinion TEXT;

-- 2. 코멘트 추가 (문서화용)
COMMENT ON COLUMN students.military_status IS '병역 사항 (미필, 필, 면제 등)';
COMMENT ON COLUMN students.desired_work_area IS '취업 희망 지역';
COMMENT ON COLUMN students.parents_opinion IS '부모님 의견 및 희망사항';
