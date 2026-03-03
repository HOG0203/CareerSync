-- [교직원 권한 유연화 및 학반 관리 보호 정책]
-- 대시보드 및 취업 현황 조회를 위해 전체 조회 권한을 개방하고, 수정 권한만 담당 학반으로 제한합니다.

-- 1. students (기본정보) 테이블 정책 재설정
DROP POLICY IF EXISTS "Admin_Full_Access" ON public.students;
DROP POLICY IF EXISTS "Teacher_Assigned_Access" ON public.students;

-- [조회] 관리자와 교직원 모두 모든 학생 조회 가능
CREATE POLICY "Allow_Read_All_For_Staff" ON public.students
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- [수정/삭제/추가] 관리자는 모든 권한, 담임교사는 본인 담당만
CREATE POLICY "Staff_Write_Policy" ON public.students
    FOR ALL 
    USING (public.is_admin())
    WITH CHECK (
        public.is_admin() OR 
        (
            graduation_year = (SELECT assigned_year FROM public.profiles WHERE id = auth.uid()) AND
            major = (SELECT assigned_major FROM public.profiles WHERE id = auth.uid()) AND
            class_info = (SELECT assigned_class FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 2. student_employments (취업정보) 테이블 정책 재설정
DROP POLICY IF EXISTS "Admin_Full_Access" ON public.student_employments;
DROP POLICY IF EXISTS "Teacher_Assigned_Access" ON public.student_employments;

-- [조회] 모두 가능
CREATE POLICY "Allow_Read_All_For_Staff" ON public.student_employments
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- [수정] 관리자 전권 또는 담임교사 본인 담당 학생만
CREATE POLICY "Staff_Write_Policy" ON public.student_employments
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_employments.id
            AND s.graduation_year = (SELECT assigned_year FROM public.profiles WHERE id = auth.uid())
            AND s.major = (SELECT assigned_major FROM public.profiles WHERE id = auth.uid())
            AND s.class_info = (SELECT assigned_class FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 3. 학적 이력 및 상담 기록
-- 조회는 모두 가능하게 하여 대시보드 통계 등에 반영되도록 함
DROP POLICY IF EXISTS "Full access for admins" ON public.student_counseling_logs;
DROP POLICY IF EXISTS "Limited access for teachers" ON public.student_counseling_logs;
CREATE POLICY "Allow_Read_All" ON public.student_counseling_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Write_Own_Or_Admin" ON public.student_counseling_logs FOR ALL USING (public.is_admin() OR author_id = auth.uid());

DROP POLICY IF EXISTS "Full access for admins" ON public.student_academic_history;
CREATE POLICY "Allow_Read_All" ON public.student_academic_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin_Write_All" ON public.student_academic_history FOR ALL USING (public.is_admin());

COMMENT ON TABLE public.students IS '교직원 전체 조회 권한이 적용된 학생 테이블';
