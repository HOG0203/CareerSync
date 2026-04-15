-- [순번 컬럼 삭제 및 학생 ID 형식 변경 대응]
-- sort_order 컬럼을 삭제하고, student_id는 YYXXX 형식을 따릅니다.

ALTER TABLE public.student_employments 
DROP COLUMN IF EXISTS sort_order;

COMMENT ON TABLE public.student_employments IS '통합 학생 및 취업 정보 테이블 (sort_order 삭제됨)';
