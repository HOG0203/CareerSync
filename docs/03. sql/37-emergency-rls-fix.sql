-- [관리자 및 교사 권한 긴급 복구 스크립트 - 수정 버전]
-- 컬럼명 불일치 문제를 해결하고 관리자 및 교사 권한을 복구합니다.

-- 1. 관리자 여부를 체크하는 보안 함수 생성 (재귀 방지)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. students 테이블 정책 재설정
DROP POLICY IF EXISTS "Admins have full access" ON public.students;
DROP POLICY IF EXISTS "Teachers access assigned" ON public.students;

-- 관리자 정책
CREATE POLICY "Admins have full access" ON public.students
    FOR ALL USING (public.check_is_admin());

-- 담임교사 정책 (students 테이블의 실제 컬럼명 사용)
CREATE POLICY "Teachers access assigned" ON public.students
    FOR ALL USING (
        graduation_year = (SELECT assigned_year FROM public.profiles WHERE id = auth.uid()) AND
        major = (SELECT assigned_major FROM public.profiles WHERE id = auth.uid()) AND
        class_info = (SELECT assigned_class FROM public.profiles WHERE id = auth.uid())
    );

-- 3. student_employments 테이블 정책 재설정
DROP POLICY IF EXISTS "Admins have full access" ON public.student_employments;
DROP POLICY IF EXISTS "Teachers access assigned" ON public.student_employments;

CREATE POLICY "Admins have full access" ON public.student_employments
    FOR ALL USING (public.check_is_admin());

CREATE POLICY "Teachers access assigned" ON public.student_employments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_employments.id
            AND s.graduation_year = (SELECT assigned_year FROM public.profiles WHERE id = auth.uid())
            AND s.major = (SELECT assigned_major FROM public.profiles WHERE id = auth.uid())
            AND s.class_info = (SELECT assigned_class FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 4. 상담 기록 정책 재설정
DROP POLICY IF EXISTS "Full access for admins" ON public.student_counseling_logs;
DROP POLICY IF EXISTS "Limited access for teachers" ON public.student_counseling_logs;

CREATE POLICY "Full access for admins" ON public.student_counseling_logs FOR ALL USING (public.check_is_admin());
CREATE POLICY "Limited access for teachers" ON public.student_counseling_logs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_counseling_logs.student_id
        AND s.graduation_year = (SELECT assigned_year FROM public.profiles WHERE id = auth.uid())
        AND s.major = (SELECT assigned_major FROM public.profiles WHERE id = auth.uid())
        AND s.class_info = (SELECT assigned_class FROM public.profiles WHERE id = auth.uid())
    )
);

-- 5. 학적 이력 정책 재설정
DROP POLICY IF EXISTS "Full access for admins" ON public.student_academic_history;
DROP POLICY IF EXISTS "Limited access for teachers" ON public.student_academic_history;

CREATE POLICY "Full access for admins" ON public.student_academic_history FOR ALL USING (public.check_is_admin());
CREATE POLICY "Limited access for teachers" ON public.student_academic_history FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_academic_history.student_id
        AND s.graduation_year = (SELECT assigned_year FROM public.profiles WHERE id = auth.uid())
        AND s.major = (SELECT assigned_major FROM public.profiles WHERE id = auth.uid())
        AND s.class_info = (SELECT assigned_class FROM public.profiles WHERE id = auth.uid())
    )
);
