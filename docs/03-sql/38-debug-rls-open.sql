-- [RLS 보안 정책 완전 초기화 및 강제 개방]
-- 의존성 문제를 해결하기 위해 CASCADE를 사용하여 기존 정책을 모두 밀어버립니다.

-- 1. 의존성이 걸린 모든 정책 및 함수 강제 삭제
DROP POLICY IF EXISTS "Admins have full access" ON public.students CASCADE;
DROP POLICY IF EXISTS "Teachers access assigned" ON public.students CASCADE;
DROP POLICY IF EXISTS "Admins have full access" ON public.student_employments CASCADE;
DROP POLICY IF EXISTS "Teachers access assigned" ON public.student_employments CASCADE;
DROP POLICY IF EXISTS "Full access for admins" ON public.student_counseling_logs CASCADE;
DROP POLICY IF EXISTS "Limited access for teachers" ON public.student_counseling_logs CASCADE;
DROP POLICY IF EXISTS "Full access for admins" ON public.student_academic_history CASCADE;
DROP POLICY IF EXISTS "Limited access for teachers" ON public.student_academic_history CASCADE;

DROP FUNCTION IF EXISTS public.check_is_admin() CASCADE;

-- 2. 모든 테이블 RLS 임시 완전 허용 (인증된 사용자 대상)
-- students 테이블
CREATE POLICY "Debug_Open_Access" ON public.students FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- student_employments 테이블
CREATE POLICY "Debug_Open_Access" ON public.student_employments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- student_counseling_logs 테이블
CREATE POLICY "Debug_Open_Access" ON public.student_counseling_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- student_academic_history 테이블
CREATE POLICY "Debug_Open_Access" ON public.student_academic_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- profiles 테이블
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles CASCADE;
CREATE POLICY "Debug_Open_Access" ON public.profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.students IS '디버깅을 위해 모든 인증 사용자에게 개방됨';
