-- [프로필 테이블 담당 학년 컬럼 추가]
-- 교직원의 담당 학급 지정 시 학년 정보를 명시적으로 저장하기 위한 컬럼을 추가합니다.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_grade INTEGER;

COMMENT ON COLUMN public.profiles.assigned_grade IS '담당 학년 (1, 2, 3)';
