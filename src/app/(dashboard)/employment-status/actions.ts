'use server';

import { getCachedYearlyRankingsSummary } from '@/lib/data';

/**
 * 백그라운드에서 성적 및 석차 요약을 비동기로 가져오기 위한 Server Action (서버 캐시 사용)
 */
export async function fetchYearlyRankings(graduationYear: number, baseYear: number) {
  try {
    return await getCachedYearlyRankingsSummary(graduationYear, baseYear);
  } catch (error) {
    console.error('Error in fetchYearlyRankings server action:', error);
    return {};
  }
}
