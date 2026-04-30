import { Metadata } from 'next';
import { getFilteredStudentData, getGraduationYears, StudentEmploymentData, getYearlyRankingsSummary, getCurrentUserProfile } from '@/lib/data';
import { cn } from '@/lib/utils';
import EmploymentStatusFilters from './employment-status-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { StudentGridCell } from './student-grid-cell';
import { Grid3X3 } from 'lucide-react';

export const metadata: Metadata = {
  title: '취업상세현황 | CareerSync',
  description: '반별/학생별 취업 현황 그리드뷰',
};

/**
 * 범례와 100% 일치하는 색상 매핑 함수
 */
const getCompanyTypeVariant = (type?: string, businessType?: string) => {
  // 1순위: 특수 상태 (채용진행, 현장실습, 도제OJT) -> 범례와 동일한 색상 적용
  if (businessType === '채용진행중') return 'bg-amber-100 text-amber-950 border-amber-500 border-x';
  if (businessType === '현장실습중') return 'bg-blue-400 text-white border-blue-500 border-x';
  if (businessType === '도제OJT') return 'bg-emerald-100 text-emerald-900 border-emerald-500 border-x';

  // 2순위: 취업이 아닌 경우 -> 흰색 유지
  if (businessType !== '취업') return 'bg-white text-black border-gray-200';

  // 3순위: 취업자인 경우 기업 유형별 색상 적용 (범례와 1:1 매칭)
  switch (type) {
    case '대기업':
    case '공기업':
      return 'bg-blue-600 text-white border-blue-700';
    case '공무원':
    case '부사관':
      return 'bg-indigo-700 text-white border-indigo-800';
    case '중견기업':
      return 'bg-purple-600 text-white border-purple-700';
    case '중소기업':
      return 'bg-cyan-500 text-white border-cyan-600';
    case '연계교육':
      return 'bg-orange-500 text-white border-orange-600';
    default:
      return 'bg-emerald-500 text-white border-emerald-600';
  }
};


const MAJOR_MAP: Record<string, string> = {
  '자동화기계과': '기계',
  '자동차기계과': '자동차',
  '친환경자동차과': '자동차',
  '전기과': '전기',
  '스마트전기과': '전기',
  '스마트공간건축과': '건축',
  '스마트공간과': '건축',
  '건설과': '건설',
  '섬유소재과': '섬유',
  '스마트융합섬유과': '섬유',
  '바이오화학과': '화학',
  '화학공업과': '화학',
};

const getShortClassName = (major: string, classInfo: string) => {
  const shortMajor = MAJOR_MAP[major] || major;
  return `${shortMajor} ${classInfo}`;
};

const SORT_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '자동차기계과',
  '스마트공간과',
  '건설과',
  '스마트공간건축과',
  '스마트전기과',
  '전기과',
  '바이오화학과',
  '화학공업과',
  '스마트융합섬유과',
  '섬유소재과'
];

export default async function EmploymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;

  const [graduationYears, settings, userProfile] = await Promise.all([
    getGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile()
  ]);

  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;

  const [allData, rankingMap] = await Promise.all([
    getFilteredStudentData(selectedYear),
    getYearlyRankingsSummary(parseInt(selectedYear), settings.baseYear)
  ]);

  const displayAY = params.ay ? parseInt(params.ay) : (parseInt(selectedYear) - (4 - grade));

  const groupedData: Record<string, StudentEmploymentData[]> = {};
  for (const student of allData) {
    const major = student.major || '';
    const classInfo = student.class_info || '';
    const displayClassName = getShortClassName(major, classInfo);
    if (!groupedData[displayClassName]) groupedData[displayClassName] = [];
    groupedData[displayClassName].push(student);
  }

  const majorOrderMap = new Map(SORT_ORDER.map((m, i) => [MAJOR_MAP[m] || m, i]));

  const classNames = Object.keys(groupedData).sort((a, b) => {
    const majorA = a.split(' ')[0];
    const majorB = b.split(' ')[0];
    const orderA = majorOrderMap.get(majorA) ?? 999;
    const orderB = majorOrderMap.get(majorB) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b, 'ko');
  });

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between shrink-0 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Grid3X3 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            취업상세현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="text-blue-600 font-bold">{displayAY}학년도 {grade}학년</span> 취업 및 현장실습 현황
          </p>
        </div>
        
        <div className="flex flex-col items-start sm:items-end gap-3 sm:gap-2">
          <div className="shrink-0 scale-90 sm:scale-100 origin-left sm:origin-right">
            <EmploymentStatusFilters 
              graduationYears={graduationYears} 
              defaultYear={defaultGradYear}
              baseYear={settings.baseYear}
            />
          </div>
          
          <div className="grid grid-cols-3 xs:grid-cols-3 sm:flex gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-1.5 text-[9px] sm:text-[10px] font-medium pt-2 sm:pt-0 border-t sm:border-none w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm shrink-0"></div> 대/공기업</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-indigo-700 rounded-sm shrink-0"></div> 공무원/부사관</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-purple-600 rounded-sm shrink-0"></div> 중견기업</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm shrink-0"></div> 중소기업</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm shrink-0"></div> 연계교육</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm shrink-0"></div> 기타</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-amber-100 rounded-sm shrink-0 border border-amber-500"></div> 채용진행중</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-blue-400 rounded-sm shrink-0 border border-blue-500"></div> 현장실습중</div>
            <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-emerald-100 rounded-sm shrink-0 border border-emerald-500"></div> 도제OJT</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-50/50 rounded-xl border border-slate-200 shadow-sm p-2 sm:p-4">
        <div className="flex gap-px bg-gray-300 border border-gray-300 min-w-max mx-auto shadow-sm">
          {classNames.map((className) => {
            const students = [...groupedData[className]].sort((a, b) => 
              (parseInt(a.student_number || '0')) - (parseInt(b.student_number || '0'))
            );
            const totalCount = students.length;

            return (
              <div key={className} className="flex flex-col bg-white w-[72px]">
                <div className="bg-[#f2f2f2] border-b border-gray-300 h-8 flex items-center justify-center font-bold text-[9px] sm:text-[10px] text-gray-700 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {className}
                </div>
                <div className="bg-emerald-500 text-white h-6 flex items-center justify-center font-bold text-[10.5px]">
                  {totalCount}
                </div>

                <div className="flex flex-col">
                  {students.map((student, idx) => (
                    <StudentGridCell 
                      key={student.id}
                      student={student}
                      idx={idx}
                      variant={getCompanyTypeVariant(student.company_type, student.business_type)}
                      rankingSummary={rankingMap[student.id]}
                      userProfile={userProfile}
                    />
                  ))}
                  {Array.from({ length: Math.max(0, 24 - students.length) }).map((_, i) => (
                    <div key={i} className="h-7 border-b border-gray-100 bg-white"></div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
