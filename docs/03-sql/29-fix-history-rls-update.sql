-- [학적 이력 수정 권한 강화]
-- UPSERT가 정상적으로 작동하려면 INSERT 뿐만 아니라 UPDATE 권한도 확실히 부여되어야 합니다.

DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON public.student_academic_history;

CREATE POLICY "Enable insert/update for authenticated users" ON public.student_academic_history
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Enable insert/update for authenticated users" ON public.student_academic_history IS '인증된 사용자의 학적 이력 추가 및 수정을 허용합니다 (UPSERT 대응)';
