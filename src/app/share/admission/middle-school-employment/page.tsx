import { 
  getCachedMiddleSchoolEmploymentData, 
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { MiddleSchoolEmploymentClient } from '@/app/(dashboard)/admission/middle-school-employment/middle-school-employment-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '[읽기전용] 중학교별 취업현황 | CareerSync',
  description: '출신 중학교별 취업처 현황 및 입학 전형 성적 매칭 관리 (외부 공유용)',
};

export default async function SharedMiddleSchoolEmploymentPage() {
  // 시스템 설정 및 전교생 취업 데이터를 병렬로 즉각 조회 (초고속 캐시 적중 시 0ms)
  const [settings, students] = await Promise.all([
    getSystemSettings(),
    getCachedMiddleSchoolEmploymentData(),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <MiddleSchoolEmploymentClient
          initialStudents={students}
          baseYear={settings.baseYear}
          isReadOnly={true}
        />
      </div>
    </div>
  );
}
