-- 1. 무한 루프를 방지하기 위해 RLS를 우회하여 현재 사용자의 권한ㅁ을 가져오는 함수 생성
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. 기존의 문제가 되는 정책들 삭제
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins have full access to student data" ON student_employments;
DROP POLICY IF EXISTS "Teachers can view and update student data" ON student_employments;
DROP POLICY IF EXISTS "Teachers can insert/update student data" ON student_employments;

-- 3. profiles 테이블에 안전한 정책 다시 적용
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    public.get_my_role() = 'admin'
  );

-- 4. student_employments 테이블에 안전한 정책 다시 적용
CREATE POLICY "Admins have full access to student data" ON student_employments
  FOR ALL USING (
    public.get_my_role() = 'admin'
  );

CREATE POLICY "Teachers can view and update student data" ON student_employments
  FOR SELECT USING (
    public.get_my_role() IN ('admin', 'teacher')
  );

CREATE POLICY "Teachers can insert/update student data" ON student_employments
  FOR ALL USING (
    public.get_my_role() IN ('admin', 'teacher')
  );
