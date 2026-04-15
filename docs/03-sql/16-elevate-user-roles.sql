-- 1. 현재 등록된 모든 사용자의 역할을 'admin'으로 상향 조정
-- ENUM 타입 정의에 맞게 'pending'이나 'teacher'인 경우를 'admin'으로 변경합니다.
UPDATE public.profiles
SET role = 'admin'::user_role
WHERE role = 'teacher' OR role = 'pending';

-- 2. 확인용
SELECT email, role FROM public.profiles;
