-- [상담 기록 및 기초 진로 데이터 필드 추가]
-- 1, 2학년 학생들의 조기 진로 지도와 담임교사 상담을 위한 필드를 추가합니다.

ALTER TABLE public.student_employments 
ADD COLUMN IF NOT EXISTS counseling_log TEXT,
ADD COLUMN IF NOT EXISTS career_aspiration TEXT;

COMMENT ON COLUMN public.student_employments.counseling_log IS '담임교사 상담 기록 (학반관리용)';
COMMENT ON COLUMN public.student_employments.career_aspiration IS '기초 진로 희망 분야 (저학년용)';
