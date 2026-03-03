-- student_employments 테이블에 복교유무(is_returned) 컬럼 추가
ALTER TABLE student_employments ADD COLUMN IF NOT EXISTS is_returned TEXT;

-- 기존 데이터에 기본값 설정 (필요한 경우)
COMMENT ON COLUMN student_employments.is_returned IS '복교 유무 (O, X)';
