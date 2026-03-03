-- 1. Profiles 테이블 확장 (담당 정보 컬럼 추가)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_year INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_major TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_class TEXT;

-- 2. 학생 세부 사항 테이블 생성 (student_personal_details)
CREATE TABLE IF NOT EXISTS public.student_personal_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_id UUID NOT NULL REFERENCES public.student_employments(id) ON DELETE CASCADE,
  career_aspiration TEXT,
  special_notes TEXT,
  certificates TEXT,
  shoe_size TEXT,
  top_size TEXT,
  personal_remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(employment_id)
);

-- 3. RLS 설정 (보안)
ALTER TABLE public.student_personal_details ENABLE ROW LEVEL SECURITY;

-- 교직원은 본인이 담당한 학생의 세부 정보만 조회 및 수정 가능
CREATE POLICY "Teachers can manage assigned student details" ON public.student_personal_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.student_employments e ON e.id = student_personal_details.employment_id
      WHERE p.id = auth.uid()
      AND (
        p.role = 'admin' OR 
        (p.assigned_year = e.graduation_year AND p.assigned_major = e.major AND p.assigned_class = e.class_info)
      )
    )
  );

-- 4. student_employments RLS 강화 (담당 학생만 수정 가능하도록)
DROP POLICY IF EXISTS "Teachers can view and update student data" ON student_employments;
DROP POLICY IF EXISTS "Teachers can insert/update student data" ON student_employments;

CREATE POLICY "Teachers can manage assigned students" ON student_employments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'admin' OR 
        (p.assigned_year = student_employments.graduation_year AND p.assigned_major = student_employments.major AND p.assigned_class = student_employments.class_info)
      )
    )
  );
