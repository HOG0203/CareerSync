import { Metadata } from 'next';
import { getCachedFilteredStudentData, getCachedGraduationYears, getCachedTeacherProfiles, StudentEmploymentData, getCurrentUserProfile } from '@/lib/data';
import { cn } from '@/lib/utils';
import LaborEducationFilters from './labor-education-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { LaborEducationGridCell } from './labor-grid-cell';
import { ShieldAlert } from 'lucide-react';
import React from 'react';
import { GridLoadingSkeleton } from '@/components/dashboard/loading-skeleton';

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

const getShortClassName = (major: string, grade: number, classInfo: string) => {
  const shortMajor = MAJOR_MAP[major] || major;
  const cleanClass = (classInfo || '').replace(/반|학년/g, '').trim();
  return `${shortMajor}${grade}-${cleanClass}`;
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

export const dynamic = 'force-dynamic';

export default async function LaborEducationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  return <LaborEducationPageContent searchParams={params} />;
}

async function LaborEducationPageContent({
  searchParams,
}: {
  searchParams: { year?: string; ay?: string; grade?: string };
}) {
  const params = searchParams;

  const [graduationYears, settings, profile, teacherProfiles] = await Promise.all([
    getCachedGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile(),
    getCachedTeacherProfiles()
  ]);

  const isAdmin = profile?.role === 'admin';

  // 담임 교사인 경우 해당 학년과 현재 학사학년도를 기본값으로 설정
  const defaultAY = settings.baseYear;
  let defaultGrade = 3;
  if (profile?.role === 'teacher' && profile.assigned_grade) {
    defaultGrade = profile.assigned_grade;
  }

  const ay = params.ay ? parseInt(params.ay) : defaultAY;
  const grade = params.grade ? parseInt(params.grade) : defaultGrade;
  const calculatedGradYear = (ay + (4 - grade)).toString();
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;

  const allData = await getCachedFilteredStudentData(selectedYear, ay);
  const displayAY = ay;

  const groupedData: Record<string, StudentEmploymentData[]> = {};
  
  for (const student of allData) {
    const major = student.major || '';
    const classInfo = student.class_info || '';
    const displayClassName = getShortClassName(major, grade, classInfo);
    
    if (!groupedData[displayClassName]) groupedData[displayClassName] = [];
    groupedData[displayClassName].push(student);
  }

  const majorOrderMap = new Map(SORT_ORDER.map((m, i) => [MAJOR_MAP[m] || m, i]));

  const classNames = Object.keys(groupedData).sort((a, b) => {
    // 예: 기계3-1 -> majorA: 기계, numA: 1
    const matchA = a.match(/^([가-힣]+)\d+-(\d+)$/);
    const matchB = b.match(/^([가-힣]+)\d+-(\d+)$/);
    
    const majorA = matchA ? matchA[1] : a.split(' ')[0];
    const majorB = matchB ? matchB[1] : b.split(' ')[0];
    
    const orderA = majorOrderMap.get(majorA) ?? 999;
    const orderB = majorOrderMap.get(majorB) ?? 999;
    
    if (orderA !== orderB) return orderA - orderB;
    
    const classNumA = matchA ? parseInt(matchA[2]) : 0;
    const classNumB = matchB ? parseInt(matchB[2]) : 0;
    return classNumA - classNumB;
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

            const sampleStudent = students[0];
            const studentMajor = sampleStudent?.major || '';
            const studentClass = sampleStudent?.class_info || '';
            const targetGrade = grade;

            let teacherName = '';

            // 1. 사용자 관리 DB (profiles)에서 현재 학년/학과/반에 배정된 담임 교사 탐색
            if (teacherProfiles && teacherProfiles.length > 0) {
              const cleanM = (studentMajor || '').replace(/과|공업계/g, '').trim();
              const cleanC = (studentClass || '').replace(/반|학년/g, '').trim();
              const matchedT = teacherProfiles.find(t => {
                const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
                const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
                const isM = tMajor === cleanM || cleanM.includes(tMajor) || tMajor.includes(cleanM);
                const isC = tClass === cleanC;
                const isG = t.assigned_grade ? t.assigned_grade === targetGrade : (t.assigned_year ? t.assigned_year === ((settings.baseYear || 2026) + (4 - targetGrade)) : true);
                return isM && isC && isG;
              });
              if (matchedT) {
                teacherName = matchedT.username || matchedT.full_name || '';
              }
            }

            // 2. 만약 profiles DB에 없으면 학생 데이터의 teacher_name 폴백 사용
            if (!teacherName) {
              teacherName = students.find(s => s.teacher_name)?.teacher_name || '';
            }

            return (
              <div key={className} className="flex flex-col bg-white w-[72px] shrink-0">
                {/* 학반 표기 (예: 기계3-1) */}
                <div className="bg-[#f2f2f2] border-b border-gray-300 h-7 flex items-center justify-center font-extrabold text-[10px] sm:text-[10.5px] text-gray-800 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {className}
                </div>

                {/* 바로 아래 담임교사 이름 표기 (예: 고홍석T) */}
                <div className="bg-emerald-50/90 border-b border-gray-300 h-5 flex items-center justify-center font-bold text-[9px] sm:text-[9.5px] text-emerald-700 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {teacherName ? `${teacherName}T` : '미지정'}
                </div>

                {/* 이수 현황 인원수 배지 */}
                <div className="bg-slate-800 text-white h-5 flex items-center justify-center font-bold text-[9.5px]">
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

