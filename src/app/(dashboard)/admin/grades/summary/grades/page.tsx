import { 
  getAchievementScores, 
  getCurrentUserProfile, 
  getYearlyRankingsSummary 
} from '@/lib/data';
import { redirect } from 'next/navigation';
import { GradeSummaryClient } from './grade-summary-client';

export default async function GradeSummaryPage() {
  const profile = await getCurrentUserProfile();

  // 관리자만 접근 가능
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // 전 학년(1, 2, 3학년)의 요약 데이터를 병렬로 초고속 조회
  // 2026년 기준: 3학년(2026졸업), 2학년(2027졸업), 1학년(2028졸업)
  const [summary3, summary2, summary1, weights] = await Promise.all([
    getYearlyRankingsSummary(2026),
    getYearlyRankingsSummary(2027),
    getYearlyRankingsSummary(2028),
    getAchievementScores()
  ]);

  // 모든 학년의 요약 정보를 하나의 리스트로 통합
  const allStudentSummaries = [
    ...Object.values(summary3),
    ...Object.values(summary2),
    ...Object.values(summary1)
  ];

  return (
    <GradeSummaryClient 
      initialSummaries={allStudentSummaries} 
      weights={weights} 
    />
  );
}
