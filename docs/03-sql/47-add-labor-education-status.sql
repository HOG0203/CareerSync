-- 노동인권교육 이수 여부 컬럼 추가
ALTER TABLE students ADD COLUMN IF NOT EXISTS labor_education_status TEXT DEFAULT '미이수';

-- 기존 데이터 초기화 (null일 경우 '미이수'로 설정)
UPDATE students SET labor_education_status = '미이수' WHERE labor_education_status IS NULL;
