import { Metadata } from 'next';
import { getFilteredStudentData, getGraduationYears, StudentEmploymentData, getCurrentUserProfile } from '@/lib/data';
import { cn } from '@/lib/utils';
import LaborEducationFilters from './labor-education-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { LaborEducationGridCell } from './labor-grid-cell';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: '노동인권교육 이수현황 | CareerSync',
  description: '반별/학생별 노동인권교육 이수 현황 그리드뷰',
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

export default async function LaborEducationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;

  const [graduationYears, settings, profile] = await Promise.all([
    getGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile()
  ]);

  const isAdmin = profile?.role === 'admin';

  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;

  const allData = await getFilteredStudentData(selectedYear);
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
            <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600" />
            노동인권교육 이수현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="text-emerald-600 font-bold">{displayAY}학년도 {grade}학년</span> 교육 이수 여부 관리
          </p>
        </div>
        
        <div className="flex flex-col items-start sm:items-end gap-3 sm:gap-2">
          <div className="shrink-0 scale-90 sm:scale-100 origin-left sm:origin-right">
            <LaborEducationFilters 
              graduationYears={graduationYears} 
              defaultYear={defaultGradYear}
              baseYear={settings.baseYear}
            />
          </div>
          
          <div className="flex gap-x-3 text-[10px] font-medium justify-end w-full">
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> 이수 완료</div>
            <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-white border border-gray-200 rounded-sm"></div> 미이수</div>
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
            const completedCount = students.filter(s => s.labor_education_status === '이수').length;

            return (
              <div key={className} className="flex flex-col bg-white w-[72px]">
                <div className="bg-[#f2f2f2] border-b border-gray-300 h-8 flex items-center justify-center font-bold text-[9px] sm:text-[10px] text-gray-700 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {className}
                </div>
                <div className="bg-slate-800 text-white h-6 flex items-center justify-center font-bold text-[10px]">
                  {completedCount} / {totalCount}
                </div>

                <div className="flex flex-col">
                  {students.map((student, idx) => (
                    <LaborEducationGridCell 
                      key={student.id}
                      student={student}
                      idx={idx}
                      isAdmin={isAdmin}
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
