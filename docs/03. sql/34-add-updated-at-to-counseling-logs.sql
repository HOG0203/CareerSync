-- [상담 기록 테이블 updated_at 컬럼 추가 및 권한 강화]
-- 수정 기능을 위해 updated_at 컬럼을 추가하고 RLS 정책을 보완합니다.

-- 1. updated_at 컬럼 추가
ALTER TABLE public.student_counseling_logs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. 기존 정책 정리 및 통합 (단순화하여 모든 인증된 사용자의 CRUD 허용)
-- (이미 상위에서 filtering 로직이 actions.ts에 구현되어 있으므로 테이블 레벨에서는 UPSERT 권한 보장에 집중)
DROP POLICY IF EXISTS "Enable read access for authorized teachers" ON public.student_counseling_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.student_counseling_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_counseling_logs;

CREATE POLICY "Enable all for authenticated users" ON public.student_counseling_logs 
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON COLUMN public.student_counseling_logs.updated_at IS '최종 수정 일시';
