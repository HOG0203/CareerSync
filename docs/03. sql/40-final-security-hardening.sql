-- [시스템 보안 강화 및 RLS 최종 정비 - 중복 함수 제거 버전]
-- 중복된 보안 함수를 정리하고 담임교사 배정제를 엄격하게 적용합니다.

-- 1. 기존 중복 함수들 삭제 (인자 유무 상관없이 모두 삭제)
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_admin() CASCADE;

-- 2. 관리자 여부를 가장 빠르고 안전하게 체크하는 통합 함수 생성
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. students (기본정보) 테이블 보안 강화
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin_Full_Access" ON public.students;
DROP POLICY IF EXISTS "Teacher_Assigned_Access" ON public.students;
DROP POLICY IF EXISTS "Debug_Open_Access" ON public.students;
DROP POLICY IF EXISTS "Temporary full access for authenticated" ON public.students;

CREATE POLICY "Admin_Full_Access" ON public.students
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher_Assigned_Access" ON public.students
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'teacher'
            AND p.assigned_year = students.graduation_year
            AND p.assigned_major = students.major
            AND p.assigned_class = students.class_info
        )
    );

-- 4. student_employments (취업정보) 테이블 보안 강화
ALTER TABLE public.student_employments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin_Full_Access" ON public.student_employments;
DROP POLICY IF EXISTS "Teacher_Assigned_Access" ON public.student_employments;
DROP POLICY IF EXISTS "Debug_Open_Access" ON public.student_employments;

CREATE POLICY "Admin_Full_Access" ON public.student_employments
    FOR ALL USING (public.is_admin());

CREATE POLICY "Teacher_Assigned_Access" ON public.student_employments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.students s
            JOIN public.profiles p ON p.assigned_year = s.graduation_year 
                AND p.assigned_major = s.major 
                AND p.assigned_class = s.class_info
            WHERE p.id = auth.uid()
            AND s.id = student_employments.id
        )
    );

-- 5. 상담 기록 보안 강화
ALTER TABLE public.student_counseling_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin_Full_Access" ON public.student_counseling_logs;
DROP POLICY IF EXISTS "Teacher_Assigned_Access" ON public.student_counseling_logs;
DROP POLICY IF EXISTS "Debug_Open_Access" ON public.student_counseling_logs;

CREATE POLICY "Admin_Full_Access" ON public.student_counseling_logs FOR ALL USING (public.is_admin());
CREATE POLICY "Teacher_Assigned_Access" ON public.student_counseling_logs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.profiles p ON p.assigned_year = s.graduation_year 
            AND p.assigned_major = s.major 
            AND p.assigned_class = s.class_info
        WHERE p.id = auth.uid()
        AND s.id = student_counseling_logs.student_id
    )
);

-- 6. profiles 테이블 보안 강화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin_Manage_All" ON public.profiles;
DROP POLICY IF EXISTS "Self_Read_Only" ON public.profiles;
DROP POLICY IF EXISTS "Debug_Open_Access" ON public.profiles;

CREATE POLICY "Admin_Manage_All" ON public.profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Self_Read_Only" ON public.profiles FOR SELECT USING (auth.uid() = id);

COMMENT ON FUNCTION public.is_admin() IS '관리자 여부를 판별하는 유일한 표준 보안 함수';
