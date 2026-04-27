-- 학생 출결 현황 테이블 생성
CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year INTEGER NOT NULL, -- 학사학년도 (예: 2026)
    grade INTEGER NOT NULL,          -- 학년
    semester INTEGER NOT NULL,       -- 학기
    school_days INTEGER DEFAULT 0,   -- 수업일수

    -- 결석 (Absent)
    absent_disease INTEGER DEFAULT 0,
    absent_unexcused INTEGER DEFAULT 0,
    absent_other INTEGER DEFAULT 0,

    -- 지각 (Late)
    late_disease INTEGER DEFAULT 0,
    late_unexcused INTEGER DEFAULT 0,
    late_other INTEGER DEFAULT 0,

    -- 조퇴 (Early Leave)
    early_disease INTEGER DEFAULT 0,
    early_unexcused INTEGER DEFAULT 0,
    early_other INTEGER DEFAULT 0,

    -- 결과 (Out)
    out_disease INTEGER DEFAULT 0,
    out_unexcused INTEGER DEFAULT 0,
    out_other INTEGER DEFAULT 0,

    remarks TEXT,                    -- 특기사항
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- 한 학생의 특정 학년/학기 데이터는 유일해야 함
    UNIQUE(student_id, academic_year, grade, semester)
);

-- RLS (Row Level Security) 설정
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 권한 가짐
CREATE POLICY "Admin can do everything on attendance"
ON public.student_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 교사는 조회만 가능 (자신의 담당 여부와 관계없이 전체 조회 허용 - 옥저인증 공유 목적)
CREATE POLICY "Teachers can view attendance"
ON public.student_attendance
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_year_grade ON public.student_attendance(academic_year, grade);
