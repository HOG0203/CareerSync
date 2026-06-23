-- [학적 이력 확장]
-- 진급 및 정보 수정 시 해당 학생의 담당 교사 이름을 기록하기 위해 teacher_name 컬럼 추가

ALTER TABLE public.student_academic_history
ADD COLUMN IF NOT EXISTS teacher_name TEXT;

COMMENT ON COLUMN public.student_academic_history.teacher_name IS '해당 학년도 당시의 담임 교사 성함';
