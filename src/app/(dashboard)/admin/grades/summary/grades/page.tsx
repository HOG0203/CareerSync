import { 
  getAchievementScores, 
  getCurrentUserProfile, 
  getYearlyRankingsSummary
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { GradeSummaryClient } from './grade-summary-client';

export default async function GradeSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  // 관리자만 접근 가능
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // 시스템 설정에서 기준 학사학년도 가져오기 (정확한 경로에서 임포트)
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  // URL 파라미터에서 학년 정보를 읽음 (기본값 3학년)
  const { grade } = await searchParams;
  const selectedGradeNum = grade ? parseInt(grade) : 3;
  
  /**
   * [계산 로직]
   * 현재 3학년 = baseYear + 1년 졸업
   * 현재 2학년 = baseYear + 2년 졸업
   * 현재 1학년 = baseYear + 3년 졸업
   */
  const targetGradYear = baseYear + (4 - selectedGradeNum);

  // 선택된 학년의 요약 데이터만 서버에서 가져옴
  const [summaryMap, weights] = await Promise.all([
    getYearlyRankingsSummary(targetGradYear, baseYear),
    getAchievementScores()
  ]);

  const studentSummaries = Object.values(summaryMap);

  return (
    <GradeSummaryClient 
      initialSummaries={studentSummaries as any[]} 
      weights={weights}
      currentGrade={selectedGradeNum} 
    />
  );
}
