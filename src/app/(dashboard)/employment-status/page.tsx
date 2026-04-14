import { Metadata } from 'next';
import { getFilteredStudentData, getGraduationYears, StudentEmploymentData } from '@/lib/data';
import { cn } from '@/lib/utils';
import EmploymentStatusFilters from './employment-status-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { StudentGridCell } from './student-grid-cell';
import { Grid3X3 } from 'lucide-react';

export const metadata: Metadata = {
  title: '취업상세현황 | CareerSync',
  description: '반별/학생별 취업 현황 그리드뷰',
};

const getCompanyTypeVariant = (type?: string, businessType?: string) => {
  if (businessType !== '예') return 'bg-white text-black border-gray-200';
  
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

// 학과 정렬 순서 정의
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

  // 1. 기반 설정 패칭
  const [graduationYears, settings] = await Promise.all([
    getGraduationYears(),
    getSystemSettings()
  ]);

  // 학사학년도(AY)와 학년(Grade) 기반 졸업연도 계산
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 기본 조회 졸업연도 결정
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;

  // 2. 타겟 데이터 패칭 (해당 학년의 데이터만 DB에서 직접 필터링하여 가져옴)
  const allData = await getFilteredStudentData(selectedYear);

  // 학사학년도 표시용
  const displayAY = params.ay ? parseInt(params.ay) : (parseInt(selectedYear) - (4 - grade));

  // 3. 필터링 및 그룹화 로직 최적화
  const groupedData: Record<string, StudentEmploymentData[]> = {};
  
  for (const student of allData) {
    const major = student.major || '';
    const classInfo = student.class_info || '';
    const displayClassName = getShortClassName(major, classInfo);
    
    if (!groupedData[displayClassName]) groupedData[displayClassName] = [];
    groupedData[displayClassName].push(student);
  }

  // 3. 정렬 로직 최적화
  // 미리 학과별 순서 맵을 생성하여 조회 성능 향상
  const majorOrderMap = new Map(SORT_ORDER.map((m, i) => [MAJOR_MAP[m] || m, i]));

  const classNames = Object.keys(groupedData).sort((a, b) => {
    // 그룹명 "기계 3-1"에서 "기계" 부분만 추출
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
        {/* 좌측: 제목 및 부제목 */}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Grid3X3 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            취업상세현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="text-blue-600 font-bold">{displayAY}학년도 {grade}학년</span> 취업 및 현장실습 현황
          </p>
        </div>
        
        {/* 우측: 필터 및 범례 */}
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
