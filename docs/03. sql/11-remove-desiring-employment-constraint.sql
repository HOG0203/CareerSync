-- [희망유무 제약 조건 제거]
-- 데이터의 자유로운 입력을 위해 is_desiring_employment 컬럼의 제약 조건을 삭제합니다.

ALTER TABLE public.student_employments 
DROP CONSTRAINT IF EXISTS student_employments_is_desiring_employment_check;

-- 추가적으로 존재할 수 있는 다른 제한사항들도 확인하여 유연하게 변경합니다.
