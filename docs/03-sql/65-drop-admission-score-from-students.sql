-- [입학지원 관리: 입학 성적(총점) 컬럼 삭제]
-- 입학성적(총점) 항목 삭제 요청에 따라 students 테이블에서 admission_score 컬럼을 삭제합니다.

ALTER TABLE public.students DROP COLUMN IF EXISTS admission_score;
DROP INDEX IF EXISTS idx_students_admission_score;
