import { redirect } from 'next/navigation';
import { 
  getCurrentUserProfile, 
  getCachedFilteredStudentData, 
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { MiddleSchoolEmploymentClient } from './middle-school-employment-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '중학교별 취업현황 | 입학지원 | CareerSync',
  description: '출신 중학교별 취업처 현황 및 입학 전형 성적 매칭 관리',
};

export default async function MiddleSchoolEmploymentPage() {
  const userProfile = await getCurrentUserProfile();

  if (!userProfile) {
    redirect('/login');
  }

  // 학생 계정 접근 제한
  if (userProfile.role === 'student') {
    redirect('/dashboard');
  }

  // 시스템 기준연도 조회
  const settings = await getSystemSettings();

  // 졸업생 포함 전체 학생 취업 및 입학 정보 통합 조회 (서버 캐시 적용)
  const students = await getCachedFilteredStudentData('all', settings.baseYear);

  return (
    <MiddleSchoolEmploymentClient
      initialStudents={students}
      baseYear={settings.baseYear}
      userProfile={userProfile}
    />
  );
}
