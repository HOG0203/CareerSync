-- [RLS 보안 정책 수정: INSERT/UPDATE 권한 확실히 부여]
-- FOR ALL USING만 설정된 경우 일부 환경에서 UPDATE/INSERT 권한이 누락될 수 있으므로 WITH CHECK를 추가합니다.

-- 1. students 테이블 정책 수정
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.students;
CREATE POLICY "Enable all for authenticated users" ON public.students 
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- 2. student_employments 테이블 정책 수정
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_employments;
CREATE POLICY "Enable all for authenticated users" ON public.student_employments 
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Enable all for authenticated users" ON public.students IS '인증된 사용자의 모든 작업 허용';
COMMENT ON POLICY "Enable all for authenticated users" ON public.student_employments IS '인증된 사용자의 모든 작업 허용';
