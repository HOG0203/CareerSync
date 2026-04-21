-- 성취도별 가중 점수 설정 추가
INSERT INTO system_settings (key, value)
VALUES ('achievement_scores', '{"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}')
ON CONFLICT (key) DO NOTHING;
