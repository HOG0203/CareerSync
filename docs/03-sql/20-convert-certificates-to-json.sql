-- 1. 기존 텍스트 기반 자격증 컬럼 삭제 및 JSONB 타입으로 재생성
ALTER TABLE public.student_employments DROP COLUMN IF EXISTS certificates;
ALTER TABLE public.student_employments ADD COLUMN certificates JSONB DEFAULT '[]'::jsonb;

-- 2. RLS 정책은 기존 "Admin full access" 및 "Teacher assigned class access"가 JSONB 컬럼에도 동일하게 적용됩니다.
