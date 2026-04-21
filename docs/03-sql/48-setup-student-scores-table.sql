-- 학생 성적 저장을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS public.student_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year INTEGER NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 2),
    subject TEXT NOT NULL,
    score NUMERIC,
    average_score NUMERIC,
    standard_deviation NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, academic_year, grade, semester, subject)
);

-- 인덱스 설정 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_student_scores_student_id ON public.student_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_year_grade ON public.student_scores(academic_year, grade);

-- RLS 설정
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

-- 관리자(admin)는 모든 권한 가짐
CREATE POLICY "Admin full access on student_scores" 
ON public.student_scores 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- 교사(teacher)는 조회만 가능
CREATE POLICY "Teachers can view student_scores" 
ON public.student_scores 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'teacher'
  )
);

-- 업데이트 시 updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_scores_updated_at
    BEFORE UPDATE ON public.student_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
