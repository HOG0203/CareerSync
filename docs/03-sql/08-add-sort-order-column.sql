-- [정렬용 순번 컬럼 추가]
-- 관리자가 지정한 순서대로 데이터를 유지하기 위해 sort_order 컬럼을 추가합니다.

ALTER TABLE public.student_employments 
ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 기존 데이터에 대해 기본 순번 할당 (생성일 기준)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.student_employments
)
UPDATE public.student_employments
SET sort_order = ranked.rn
FROM ranked
WHERE public.student_employments.id = ranked.id;

COMMENT ON COLUMN public.student_employments.sort_order IS '정렬용 순번';
