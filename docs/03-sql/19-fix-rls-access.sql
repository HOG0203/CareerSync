-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admins have full access" ON public.student_employments;
DROP POLICY IF EXISTS "Teachers can manage assigned class students" ON public.student_employments;

-- 정책 1: 관리자 전용 (전체 권한)
CREATE POLICY "Admin full access" ON public.student_employments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 정책 2: 교직원 전용 (본인 학급 권한)
CREATE POLICY "Teacher assigned class access" ON public.student_employments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
      AND profiles.assigned_year = student_employments.graduation_year
      AND profiles.assigned_major = student_employments.major
      AND profiles.assigned_class = student_employments.class_info
    )
  );

-- 기본 조회 권한 (인증된 모든 사용자)
CREATE POLICY "Allow select for all authenticated" ON public.student_employments
  FOR SELECT TO authenticated
  USING (true);
