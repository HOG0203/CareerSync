import { NextResponse } from 'next/server';
import { 
  getCachedFilteredStudentData, 
  getCachedGraduationYears, 
  getCachedTeacherProfiles, 
  getCachedClassStructureCombinations, 
  getCachedProfiles, 
  getCachedAllStudentBaseData,
  getCachedYearlyRankingsSummary,
  getDashboardStudentData
} from '@/lib/data';
import { getSystemSettings, getCachedMasterCertificates } from '@/app/(dashboard)/admin/settings/actions';
import { getCachedAuditLogs } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

/**
 * 백그라운드 캐시 워밍업 및 DB 웜업 API (/api/cron/warmup)
 * 오랜만에 접속해도 딜레이 없이 0.01초 만에 로딩되도록 캐시와 DB 커넥션을 주기적으로 활성화
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // 1. 기본 설정 및 기준년도 조회 (캐시 웜업)
    const settings = await getSystemSettings();
    const currentGradYear = (settings.baseYear + 1).toString();
    const nextGradYear = (settings.baseYear + 2).toString();

    // 2. 전 시스템 핵심 데이터 병렬 사전 렌더링 (Cache Warmup)
    await Promise.all([
      getCachedGraduationYears(),
      getCachedTeacherProfiles(),
      getCachedMasterCertificates(),
      getCachedClassStructureCombinations(),
      getCachedProfiles(),
      getCachedAllStudentBaseData(),
      getCachedAuditLogs(),
      getCachedFilteredStudentData(currentGradYear, settings.baseYear),
      getCachedFilteredStudentData(nextGradYear, settings.baseYear),
      getDashboardStudentData(currentGradYear),
      getCachedYearlyRankingsSummary(settings.baseYear + 1, settings.baseYear),
      getCachedYearlyRankingsSummary(settings.baseYear + 2, settings.baseYear)
    ]);

    const duration = Date.now() - startTime;
    return NextResponse.json({
      status: 'success',
      message: '전체 서버 캐시 워밍업 및 DB 웜업 완료 🔥',
      baseYear: settings.baseYear,
      durationMs: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || '캐시 워밍업 처리 중 오류 발생'
    }, { status: 500 });
  }
}
