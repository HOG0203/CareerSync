-- [분리된 테이블 구조에 맞춘 RLS 보안 정책 최종 수정]
-- 담임교사가 본인의 담당 학반 데이터만 관리할 수 있도록 JOIN 정책을 강화합니다.

-- 1. students (기본정보) 테이블 정책
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.students;
DROP POLICY IF EXISTS "Teachers can manage assigned students" ON public.students;

-- 관리자: 모든 권한
CREATE POLICY "Admins have full access to students" ON public.students
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 담임교사: 본인 담당 학반 학생만 조회 및 수정
CREATE POLICY "Teachers can manage assigned students" ON public.students
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'teacher'
            AND p.assigned_year = students.graduation_year
            AND p.assigned_major = students.major
            AND p.assigned_class = students.class_info
        )
    );

-- 2. student_employments (취업정보) 테이블 정책
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_employments;
DROP POLICY IF EXISTS "Teachers can manage assigned student employments" ON public.student_employments;

-- 관리자: 모든 권한
CREATE POLICY "Admins have full access to employments" ON public.student_employments
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 담임교사: 본인 담당 학생의 취업 정보만 관리 (students 테이블과 JOIN 체크)
CREATE POLICY "Teachers can manage assigned student employments" ON public.student_employments
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

-- 3. 상담 기록 및 학적 이력도 동일한 논리로 보호
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_counseling_logs;
CREATE POLICY "Teachers can manage assigned student logs" ON public.student_counseling_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.students s
            JOIN public.profiles p ON p.assigned_year = s.graduation_year 
                AND p.assigned_major = s.major 
                AND p.assigned_class = s.class_info
            WHERE p.id = auth.uid()
            AND s.id = student_counseling_logs.student_id
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

COMMENT ON TABLE public.students IS 'RLS 정책이 적용된 학생 마스터 테이블';
