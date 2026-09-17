import { redirect } from 'next/navigation';
import { 
  getCurrentUserProfile, 
  getCachedMiddleSchoolEmploymentData, 
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { MiddleSchoolEmploymentClient } from './middle-school-employment-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '중학교별 취업현황 | 입학지원 | CareerSync',
  description: '출신 중학교별 취업처 현황 및 입학 전형 성적 매칭 관리',
};

export default async function MiddleSchoolEmploymentPage() {
  // 프로필, 시스템 설정, 중학교별 학생 취업 데이터를 병렬로 즉각 조회 (초고속 캐시 적중 시 0ms)
  const [userProfile, settings, students] = await Promise.all([
    getCurrentUserProfile(),
    getSystemSettings(),
    getCachedMiddleSchoolEmploymentData(),
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  // 학생 계정 접근 제한
  if (userProfile.role === 'student') {
    redirect('/dashboard');
  }

  return (
    <MiddleSchoolEmploymentClient
      initialStudents={students}
      baseYear={settings.baseYear}
      userProfile={userProfile}
    />
  );
}
