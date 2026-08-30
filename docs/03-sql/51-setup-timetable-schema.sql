-- ==============================================================================
-- 51-setup-timetable-schema.sql
-- 교수학습지원 - 시간표 조회 및 관리 테이블 스키마
-- ==============================================================================

-- 1. 시간표 차수/버전 마스터 테이블
CREATE TABLE IF NOT EXISTS public.timetable_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    title TEXT NOT NULL,
    effective_date TEXT,
    total_teachers INTEGER DEFAULT 0,
    total_classes INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT timetable_schedules_year_sem_unique UNIQUE (academic_year, semester)
);

-- 2. 시간표 개별 슬롯 데이터 테이블
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.timetable_schedules(id) ON DELETE CASCADE,
    academic_year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    teacher_name TEXT NOT NULL,
    homeroom_class TEXT,
    weekly_hours NUMERIC(4, 1) DEFAULT 0,
    day_of_week TEXT NOT NULL, -- '월', '화', '수', '목', '금'
    period INTEGER NOT NULL,    -- 1 ~ 7
    subject_name TEXT NOT NULL, -- 과목명 / 활동명 ('국1', '자율', '동아'...)
    class_code TEXT,           -- 학반 코드 ('기22', '화11'...)
    dept_name TEXT,            -- 학과 정식 명칭 ('자동화기계과', '바이오화학과'...)
    grade INTEGER,             -- 학년 (1, 2, 3)
    class_num INTEGER,         -- 반 번호 (1, 2, 3...)
    remarks TEXT,              -- 비고
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_timetable_entries_schedule_id ON public.timetable_entries(schedule_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_teacher ON public.timetable_entries(teacher_name, day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_class ON public.timetable_entries(class_code, day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_year_sem ON public.timetable_entries(academic_year, semester);

-- RLS 활성화
ALTER TABLE public.timetable_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

-- 조회 및 관리 권한 설정
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'timetable_schedules' AND policyname = 'Allow all access to timetable_schedules'
    ) THEN
        CREATE POLICY "Allow all access to timetable_schedules" ON public.timetable_schedules FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'timetable_entries' AND policyname = 'Allow all access to timetable_entries'
    ) THEN
        CREATE POLICY "Allow all access to timetable_entries" ON public.timetable_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
