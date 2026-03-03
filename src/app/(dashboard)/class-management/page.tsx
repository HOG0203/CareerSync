import { createClient } from '@/lib/supabase/server';
import { getAssignedStudentDetails, getGraduationYears, getFilteredStudentData, MAJOR_SORT_ORDER } from '@/lib/data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClassTable } from './class-table';
import { ShieldAlert, Users } from 'lucide-react';
import AdminClassSelector from './admin-class-selector';
import { getMasterCertificates, getSystemSettings } from '@/app/admin/settings/actions';

export const dynamic = 'force-dynamic';

export default async function ClassManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; major?: string; class?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  
  // 1. 기반 공통 데이터 병렬 패칭
  const [userRes, settings, graduationYears, masterCertificates] = await Promise.all([
    supabase.auth.getUser(),
    getSystemSettings(),
    getGraduationYears(),
    getMasterCertificates()
  ]);

  const user = userRes.data.user;
  if (!user) return null;

  // 2. 프로필 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, assigned_year, assigned_major, assigned_class, assigned_grade')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  // 3. 학년 옵션 계산 (졸업연도 목록 기반 역산)
  const availableGradesSet = new Set<number>();
  const gradeToYearMap = new Map<number, number>();
  
  [1, 2, 3].forEach(g => {
    const y = settings.baseYear + (4 - g);
    gradeToYearMap.set(g, y);
  });

  for (const year of graduationYears) {
    for (const [g, y] of gradeToYearMap.entries()) {
      if (year === y) availableGradesSet.add(g);
    }
  }
  const availableGrades = Array.from(availableGradesSet).sort((a, b) => b - a);

  // --- 권한별 타겟 정보 결정 ---
  const selectedGrade = isAdmin 
    ? (params.grade ? parseInt(params.grade) : (availableGrades.includes(3) ? 3 : (availableGrades[0] || 3)))
    : (profile?.assigned_grade || 3);
  
  const calculatedYear = isAdmin 
    ? settings.baseYear + (4 - selectedGrade)
    : (profile?.assigned_year || settings.baseYear + (4 - selectedGrade));

  // 4. 해당 학년의 전체 데이터만 DB에서 직접 필터링하여 패칭
  const allBaseData = await getFilteredStudentData(calculatedYear.toString());

  // 학과 및 반 추출
  const availableMajorsSet = new Set<string>();
  const availableClassesSet = new Set<string>();

  for (const s of allBaseData) {
    if (s.major) availableMajorsSet.add(s.major);
  }

  const availableMajors = Array.from(availableMajorsSet).sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a);
    const indexB = MAJOR_SORT_ORDER.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  const targetMajor = isAdmin 
    ? (params.major && availableMajors.includes(params.major) ? params.major : availableMajors[0])
    : (profile?.assigned_major || null);

  // 선택된 학년 + 학과에 맞는 반들 추출
  for (const s of allBaseData) {
    if (s.major === targetMajor) {
      if (s.class_info) availableClassesSet.add(s.class_info);
    }
  }
  const availableClasses = Array.from(availableClassesSet).sort();

  const targetClass = isAdmin 
    ? (params.class && availableClasses.includes(params.class) ? params.class : availableClasses[0])
    : (profile?.assigned_class || null);

  // --- 학생 상세 데이터 패칭 ---
  const isViewable = !!(calculatedYear && targetMajor && targetClass);
  let studentData: any[] = [];

  if (isViewable) {
    // 이미 필요한 데이터가 준비되었으므로 상세 데이터를 가져옵니다.
    studentData = await getAssignedStudentDetails(calculatedYear, targetMajor!, targetClass!);
  }

  const displayClass = targetClass && !targetClass.includes('-') ? `${selectedGrade}-${targetClass}` : targetClass;

  return (
    <div className="flex flex-col gap-6 w-fit min-w-full">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            학반 관리
          </h2>
          <p className="text-muted-foreground text-xs">
            {isAdmin ? '관리자 권한으로 전교생 학반 세부 사항을 관리합니다.' : '담당 학반 학생들의 세부 사항을 관리 및 수정합니다.'}
          </p>
        </div>
      </div>

      {/* 관리자에게만 셀렉터 노출, 선생님은 정보 표시만 */}
      <div className="shrink-0">
        <AdminClassSelector 
          availableGrades={availableGrades}
          majors={isAdmin ? availableMajors : [profile?.assigned_major!]} 
          classes={isAdmin ? availableClasses : [profile?.assigned_class!]} 
          isAdmin={isAdmin}
        />
      </div>

      {isViewable ? (
        <Card className="shadow-sm border bg-white rounded-xl overflow-hidden">
          <CardHeader className="py-3 px-4 border-b bg-white/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                {targetMajor} {displayClass}반 학생별 상세 데이터
              </CardTitle>
              <CardDescription className="text-[11px] text-gray-500">
                {settings.baseYear}학년도 {selectedGrade}학년 학생들의 개인 세부 사항을 관리합니다.
              </CardDescription>
            </div>
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
              총 {studentData.length}명
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ClassTable 
              initialData={studentData} 
              masterCertificates={masterCertificates} 
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/30">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">담당 학반 미지정</h3>
          <p className="text-sm text-muted-foreground mt-1 text-center px-6 text-balance">
            교직원 계정의 경우 사용자 관리 페이지에서 담당 학반 정보가 설정되어야 이용 가능합니다.<br/>
            담당 정보가 설정되었음에도 이 화면이 보인다면 관리자에게 문의하세요.
          </p>
        </div>
      )}
    </div>
  );
}
