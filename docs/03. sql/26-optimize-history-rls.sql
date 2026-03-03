-- [학적 이력 조회 권한 최적화]
-- 담임교사가 현재 관리 권한을 가진 학생의 과거 모든 이력을 조회할 수 있도록 RLS 정책을 강화합니다.

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "Enable read access for authorized users" ON public.student_academic_history;

-- 2. 개선된 조회 정책 생성
-- (현재 권한이 있는 학생의 ID라면 학적 이력 테이블의 관련 데이터를 모두 볼 수 있음)
CREATE POLICY "Enable read access for authorized users" ON public.student_academic_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.student_employments s
            JOIN public.profiles p ON s.major = p.assigned_major AND s.class_info = p.assigned_class
            WHERE p.id = auth.uid() AND s.id = student_academic_history.student_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON POLICY "Enable read access for authorized users" ON public.student_academic_history IS '권한이 있는 학생의 모든 과거 이력 조회 허용';
