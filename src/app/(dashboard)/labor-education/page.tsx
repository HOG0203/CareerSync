import { Metadata } from 'next';
import { getCachedLaborEducationData, getCachedGraduationYears, getCachedTeacherProfiles, StudentEmploymentData, getCurrentUserProfile } from '@/lib/data';
import { cn } from '@/lib/utils';
import LaborEducationFilters from './labor-education-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { LaborEducationGridCell } from './labor-grid-cell';
import { ShieldCheck, ShieldAlert, Users, CheckCircle2, XCircle, School, BookOpen } from 'lucide-react';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getMajorOrderIndex } from '@/lib/student-utils';
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

// 축약 학과명을 원래 대표 학과명으로 복원하여 공식 정렬 순서 가져오기
const SHORT_TO_FULL_MAJOR: Record<string, string> = {
  '기계': '자동화기계과',
  '자동차': '친환경자동차과',
  '건설': '건설과',
  '건축': '스마트공간건축과',
  '전기': '스마트전기과',
  '화학': '바이오화학과',
  '섬유': '스마트융합섬유과',
};

const getShortClassName = (major: string, grade: number, classInfo: string) => {
  const shortMajor = MAJOR_MAP[major] || major;
  const cleanClass = (classInfo || '').replace(/반|학년/g, '').trim();
  return `${shortMajor}${grade}-${cleanClass}`;
};


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
  const targetGradYearInt = parseInt(selectedYear);
  let allData = await getCachedLaborEducationData(targetGradYearInt);
  const displayAY = ay;


  const groupedData: Record<string, StudentEmploymentData[]> = {};
  
  // 3학년 조회 시 '기계2-1' 컬럼에 실제 2학년 1반 기계과 학생 DB 데이터 연동
  if (grade === 3) {
    const grade2GradYear = ay + 2;
    const grade2Data = await getCachedLaborEducationData(grade2GradYear);
    const actualGrade2Mech1 = grade2Data.filter(s => {
      const shortMajor = MAJOR_MAP[s.major || ''] || s.major || '';
      const cleanClass = (s.class_info || '').replace(/반|학년/g, '').trim();
      return shortMajor === '기계' && cleanClass === '1';
    });


    // 3학년 데이터에서 기계1반을 제외하고 실제 2학년 1반 기계과 데이터로 대체
    allData = allData.filter(s => {
      const shortMajor = MAJOR_MAP[s.major || ''] || s.major || '';
      const cleanClass = (s.class_info || '').replace(/반|학년/g, '').trim();
      return !(shortMajor === '기계' && cleanClass === '1');
    });

    for (const student of allData) {
      const major = student.major || '';
      const classInfo = student.class_info || '';
      const displayClassName = getShortClassName(major, grade, classInfo);
      if (!groupedData[displayClassName]) groupedData[displayClassName] = [];
      groupedData[displayClassName].push(student);
    }

    if (actualGrade2Mech1.length > 0) {
      groupedData['기계2-1'] = actualGrade2Mech1;
    }
  } else {
    for (const student of allData) {
      const major = student.major || '';
      const classInfo = student.class_info || '';
      const displayClassName = getShortClassName(major, grade, classInfo);
      if (!groupedData[displayClassName]) groupedData[displayClassName] = [];
      groupedData[displayClassName].push(student);
    }
  }

  const classNames = Object.keys(groupedData).sort((a, b) => {
    // 예: 기계3-1 -> majorA: 기계, numA: 1
    const matchA = a.match(/^([가-힣]+)\d+-(\d+)$/);
    const matchB = b.match(/^([가-힣]+)\d+-(\d+)$/);
    
    const shortMajorA = matchA ? matchA[1] : a.split(' ')[0];
    const shortMajorB = matchB ? matchB[1] : b.split(' ')[0];

    const fullMajorA = SHORT_TO_FULL_MAJOR[shortMajorA] || shortMajorA;
    const fullMajorB = SHORT_TO_FULL_MAJOR[shortMajorB] || shortMajorB;
    
    const orderA = getMajorOrderIndex(fullMajorA);
    const orderB = getMajorOrderIndex(fullMajorB);
    
    if (orderA !== orderB) return orderA - orderB;
    
    const classNumA = matchA ? parseInt(matchA[2]) : 0;
    const classNumB = matchB ? parseInt(matchB[2]) : 0;
    return classNumA - classNumB;
  });

  // 노동인권교육 전체 통계 지표 계산
  let totalStudents = 0;
  let totalCompleted = 0;

  Object.values(groupedData).forEach((students) => {
    totalStudents += students.length;
    totalCompleted += students.filter(s => s.labor_education_status === '이수').length;
  });

  const totalUncompleted = totalStudents - totalCompleted;
  const completionRate = totalStudents > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;
  const uncompletionRate = totalStudents > 0 ? (100 - completionRate) : 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full">
      {/* 상단 타이틀 헤더 및 학년도 필터 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600" />
            노동인권교육 이수현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="text-emerald-700 font-bold">{displayAY}학년도 {grade}학년</span> 학생들의 노동인권교육 이수 여부를 반별 바둑판 그리드로 관리합니다.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <LaborEducationFilters 
            graduationYears={graduationYears} 
            defaultYear={defaultGradYear}
            baseYear={settings.baseYear}
          />
        </div>
      </div>

      {/* 요약 통계 카드 4종 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">총 대상 학생</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalStudents}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">이수 완료</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-emerald-600">{totalCompleted}명</span>
                <span className="text-xs font-bold text-emerald-600/80">({completionRate}%)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">미이수 학생</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-rose-600">{totalUncompleted}명</span>
                <span className="text-xs font-bold text-slate-400">({uncompletionRate}%)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">총 개설 학반</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">{classNames.length}개 반</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <School className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 바둑판 그리드 뷰 메인 카드 */}
      <Card className="shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden flex flex-col">
        <CardHeader className="py-3.5 px-5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              <span>반별 / 학생별 이수 현황 바둑판 그리드</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              학생 타일을 클릭하면 상세 정보 확인 및 이수 여부(이수/미이수)를 손쉽게 변경할 수 있습니다.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs font-bold shrink-0">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <div className="w-3 h-3 bg-emerald-500 rounded-xs shadow-2xs" />
              <span>이수 완료</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1.5 text-slate-600">
              <div className="w-3 h-3 bg-white border border-slate-300 rounded-xs shadow-2xs" />
              <span>미이수</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-5 overflow-x-auto">
          <div className="flex gap-px bg-slate-200/80 border border-slate-200 rounded-xl overflow-hidden min-w-max mx-auto shadow-2xs">
            {classNames.map((className) => {
              const students = [...groupedData[className]].sort((a, b) => {
                const numA = parseInt((a.student_number || '').replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt((b.student_number || '').replace(/[^0-9]/g, ''), 10) || 0;
                if (numA !== numB) return numA - numB;
                return (a.student_name || '').localeCompare(b.student_name || '', 'ko');
              });
              const totalCount = students.length;
              const completedCount = students.filter(s => s.labor_education_status === '이수').length;

              const sampleStudent = students[0];
              const studentMajor = sampleStudent?.major || '';
              const studentClass = sampleStudent?.class_info || '';
              const matchGrade = className.match(/\d+/);
              const targetGrade = matchGrade ? parseInt(matchGrade[0]) : grade;

              let teacherName = '';

              if (teacherProfiles && teacherProfiles.length > 0) {
                const cleanM = (studentMajor || '').replace(/과|공업계/g, '').trim();
                const cleanC = (studentClass || '').replace(/반|학년/g, '').trim();
                const matchedT = teacherProfiles.find(t => {
                  const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
                  const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
                  const isM = tMajor === cleanM || cleanM.includes(tMajor) || tMajor.includes(cleanM);
                  const isC = tClass === cleanC;
                  const isG = t.assigned_grade ? t.assigned_grade === targetGrade : (t.assigned_year ? t.assigned_year === (ay + (4 - targetGrade)) : true);
                  return isM && isC && isG;
                });
                if (matchedT) {
                  teacherName = matchedT.username || matchedT.full_name || '';
                }
              }

              if (!teacherName) {
                teacherName = students.find(s => s.teacher_name)?.teacher_name || '';
              }

              const isAllCompleted = totalCount > 0 && completedCount === totalCount;

              return (
                <div key={className} className="flex flex-col bg-white w-[74px] shrink-0">
                  {/* 학반 표기 (예: 기계3-1) */}
                  <div className="bg-slate-100 border-b border-slate-200 h-7 flex items-center justify-center font-black text-[10.5px] text-slate-800 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                    {className}
                  </div>

                  {/* 담임교사 이름 표기 (예: 고홍석T) */}
                  <div className="bg-emerald-50/80 border-b border-slate-200 h-5 flex items-center justify-center font-bold text-[9.5px] text-emerald-700 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                    {teacherName ? `${teacherName}T` : '미지정'}
                  </div>

                  {/* 이수 현황 인원수 배지 */}
                  <div className={cn(
                    "h-5 flex items-center justify-center font-bold text-[9.5px] text-white transition-colors",
                    isAllCompleted ? "bg-emerald-700" : "bg-slate-800"
                  )}>
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
                      <div key={i} className="h-7 border-b border-slate-100 bg-slate-50/30"></div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


