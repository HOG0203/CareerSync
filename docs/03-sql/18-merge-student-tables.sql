-- 1. student_employments 테이블에 세부 정보 컬럼 추가
ALTER TABLE public.student_employments ADD COLUMN IF NOT EXISTS career_aspiration TEXT;
ALTER TABLE public.student_employments ADD COLUMN IF NOT EXISTS special_notes TEXT;
ALTER TABLE public.student_employments ADD COLUMN IF NOT EXISTS certificates TEXT;
ALTER TABLE public.student_employments ADD COLUMN IF NOT EXISTS shoe_size TEXT;
ALTER TABLE public.student_employments ADD COLUMN IF NOT EXISTS top_size TEXT;
ALTER TABLE public.student_employments ADD COLUMN IF NOT EXISTS personal_remarks TEXT;

-- 2. 기존 데이터가 있다면 이관 (student_personal_details -> student_employments)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_personal_details') THEN
        UPDATE public.student_employments e
        SET 
            career_aspiration = d.career_aspiration,
            special_notes = d.special_notes,
            certificates = d.certificates,
            shoe_size = d.shoe_size,
            top_size = d.top_size,
            personal_remarks = d.personal_remarks
        FROM public.student_personal_details d
        WHERE e.id = d.employment_id;
    END IF;
END $$;

-- 3. 기존 세부 정보 테이블 삭제
DROP TABLE IF EXISTS public.student_personal_details;

-- 4. 통합된 RLS 정책 설정
-- 기존 정책 삭제 후 재설정
DROP POLICY IF EXISTS "Admins have full access to student data" ON student_employments;
DROP POLICY IF EXISTS "Teachers can manage assigned students" ON student_employments;

-- 정책 A: 관리자는 모든 데이터에 무제한 접근
CREATE POLICY "Admins have full access" ON public.student_employments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 정책 B: 담당 교사는 본인 학급 데이터에 대해 무제한 접근
CREATE POLICY "Teachers can manage assigned class students" ON public.student_employments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'teacher'
      AND p.assigned_year = student_employments.graduation_year
      AND p.assigned_major = student_employments.major
      AND p.assigned_class = student_employments.class_info
    )
  );

-- 정책 C: 일반 교직원 혹은 배정되지 않은 교사는 데이터 조회만 가능 (선택 사항)
-- 필요 시 아래 주석 해제하여 조회 권한 부여 가능
-- CREATE POLICY "All users can view basic data" ON public.student_employments
--   FOR SELECT USING (auth.uid() IS NOT NULL);
