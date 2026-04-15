-- [학적 이력 영구 기록 테이블 생성]
-- 학생의 1, 2, 3학년 당시 소속 정보를 보존하기 위한 테이블입니다.

CREATE TABLE IF NOT EXISTS public.student_academic_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.student_employments(id) ON DELETE CASCADE,
    academic_year INTEGER NOT NULL, -- 학년도 (예: 2026)
    grade INTEGER NOT NULL CHECK (grade IN (1, 2, 3)), -- 학년
    major TEXT NOT NULL,
    class_info TEXT NOT NULL,
    student_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- 한 학생은 한 학년에 대해 하나의 학적 기록만 가짐
    UNIQUE(student_id, grade)
);

-- RLS 활성화
ALTER TABLE public.student_academic_history ENABLE ROW LEVEL SECURITY;

-- 조회 권한: 관리자 및 담당 교사 (student_employments 권한 체계와 동일하게 운영)
CREATE POLICY "Enable read access for authorized users" ON public.student_academic_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN student_employments s ON s.major = p.assigned_major AND s.class_info = p.assigned_class
            WHERE p.id = auth.uid() AND s.id = student_academic_history.student_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 추가/수정 권한: 인증된 사용자 허용
CREATE POLICY "Enable insert/update for authenticated users" ON public.student_academic_history
    FOR ALL
    WITH CHECK (auth.uid() IS NOT NULL);

-- 초기 데이터 마이그레이션 (현재 등록된 정보를 각 학년의 첫 이력으로 저장)
-- graduation_year와 baseYear 관계를 통해 현재 학년 계산 로직 필요 (이후 서버 액션에서 처리 권장)

COMMENT ON TABLE public.student_academic_history IS '학생 학년별 학적 변동 이력';
