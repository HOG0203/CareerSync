-- [취업구분 제약 조건 확장]
-- 새로운 8가지 취업구분 항목을 허용하도록 제약 조건을 수정합니다.

-- 1. 기존 제약 조건 삭제
ALTER TABLE public.student_employments 
DROP CONSTRAINT IF EXISTS student_employments_employment_status_check;

-- 2. 새로운 항목들을 포함한 제약 조건 추가
-- 기존 항목('취업', '미취업', '구직중')과 빈 값('')도 안전을 위해 포함합니다.
ALTER TABLE public.student_employments 
ADD CONSTRAINT student_employments_employment_status_check 
CHECK (employment_status IN (
  '일반취업', '취업맞춤반', '일학습병행', '도제', 
  '군특성화', '기술사관', '면접진행중', '확인불가',
  '취업', '미취업', '구직중', ''
));

COMMENT ON CONSTRAINT student_employments_employment_status_check ON public.student_employments IS '취업구분 허용 항목 제한';
