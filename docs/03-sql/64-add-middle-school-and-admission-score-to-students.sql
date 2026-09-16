-- [입학지원 관리: 출신 중학교 및 입학 전형 성적 컬럼 추가]
-- 학생들이 출신 중학교 및 입학 당시 성적/전형 정보를 관리하기 위해 students 테이블에 컬럼을 추가합니다.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS middle_school TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS admission_rank_percentile NUMERIC;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS admission_type TEXT;

COMMENT ON COLUMN public.students.middle_school IS '출신 중학교명';
COMMENT ON COLUMN public.students.admission_rank_percentile IS '입학 석차 백분율 (%)';
COMMENT ON COLUMN public.students.admission_type IS '입학 전형 구분 (일반전형, 특별전형 등)';

-- 출신 중학교별 검색 및 집계 성능 향상을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_students_middle_school ON public.students(middle_school);
