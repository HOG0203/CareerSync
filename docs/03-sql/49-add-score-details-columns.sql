-- student_scores 테이블에 상세 필드 추가
ALTER TABLE public.student_scores 
ADD COLUMN IF NOT EXISTS credits INTEGER,
ADD COLUMN IF NOT EXISTS achievement TEXT,
ADD COLUMN IF NOT EXISTS rank_grade TEXT;

COMMENT ON COLUMN public.student_scores.credits IS '학점(이수단위)';
COMMENT ON COLUMN public.student_scores.achievement IS '성취도 (예: A, B, C)';
COMMENT ON COLUMN public.student_scores.rank_grade IS '석차등급 (예: 1, 2, 3)';
