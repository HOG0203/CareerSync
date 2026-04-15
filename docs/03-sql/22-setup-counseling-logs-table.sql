-- [상담 기록 누적 관리 테이블 생성]
-- 학생별 3년간의 상담 내역을 시계열로 저장하기 위한 테이블입니다.

CREATE TABLE IF NOT EXISTS public.student_counseling_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.student_employments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id),
    author_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS 활성화
ALTER TABLE public.student_counseling_logs ENABLE ROW LEVEL SECURITY;

-- 1. 조회 권한: 관리자는 모두, 담임은 담당 학생 기록만 (student_employments 연동)
CREATE POLICY "Enable read access for authorized teachers" ON public.student_counseling_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN student_employments s ON s.major = p.assigned_major AND s.class_info = p.assigned_class
            WHERE p.id = auth.uid() AND s.id = student_counseling_logs.student_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. 추가 권한: 인증된 사용자 허용
CREATE POLICY "Enable insert for authenticated users" ON public.student_counseling_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_counseling_student_id ON public.student_counseling_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_counseling_created_at ON public.student_counseling_logs(created_at DESC);

COMMENT ON TABLE public.student_counseling_logs IS '학생 누적 상담 기록';
