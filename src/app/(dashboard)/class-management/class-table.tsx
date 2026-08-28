'use client'

import * as React from 'react'
import { StandardSpreadsheetTable, ColumnConfig } from '@/components/dashboard/standard-spreadsheet-table'
import { updatePersonalDetail, bulkUpdatePersonalDetails } from './actions'
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions'
import { CounselingModal } from './counseling-modal'
import { fetchYearlyRankings } from '../employment-status/actions'

import { Users, Briefcase, GraduationCap, Award, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface ClassTableProps {
  initialData: any[];
  masterCertificates: MasterCertificate[];
  masterCompanies?: any[];
  userProfile?: any;
  baseYear?: number;
  graduationYear: number;
  targetMajor?: string;
  displayClass?: string;
  selectedGrade?: number;
  adminClassSelector?: React.ReactNode;
}


// 학년별 진로희망 옵션 생성 함수
const GET_CAREER_OPTIONS = (grade: number) => {
  const options = [
    { label: '취업', value: '취업' },
    { label: '진학', value: '진학' },
    { label: '제외인정자', value: '제외인정자' },
  ];
  return options;
}

// 행 데이터 기반 동적 기업유형 옵션 생성 함수
const GET_CAREER_COURSE_OPTIONS = (rowData: any) => {
  const aspiration = rowData?.career_aspiration;
  
  if (aspiration === '취업') {
    return [
      { label: '대/공기업', value: '대/공기업' },
      { label: '공무원', value: '공무원' },
      { label: '중견/강소기업', value: '중견/강소기업' },
      { label: '가업승계', value: '가업승계' },
      { label: '부사관', value: '부사관' },
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }
  
  // 제외인정자나 진학일 경우 기업유형 선택 안함
  return [];
}

// 행 데이터 기반 동적 세부 진로코스 옵션 생성 함수
const GET_SPECIFIC_COURSE_OPTIONS = (rowData: any) => {
  const aspiration = rowData?.career_aspiration;

  if (aspiration === '취업') {
    return [
      { label: '청솔반', value: '청솔반' },
      { label: '취업맞춤반', value: '취업맞춤반' },
      { label: '중견기업반', value: '중견기업반' },
      { label: '반도체아카데미반', value: '반도체아카데미반' },
      { label: '혁신인재반', value: '혁신인재반' },
      { label: '부사관반', value: '부사관반' },
      { label: '일학습병행', value: '일학습병행' },
      { label: '계약학과', value: '계약학과' },
      { label: '도제반', value: '도제반' },
      { label: '아우스빌둥', value: '아우스빌둥' },
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }

  if (aspiration === '제외인정자') {
    return [
      { label: '군특성화', value: '군특성화' },
      { label: '기술사관', value: '기술사관' },
      { label: '운동부', value: '운동부' },
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }

  if (aspiration === '진학') {
    return [
      { label: '전문대학', value: '전문대학' },
      { label: '4년제대학', value: '4년제대학' },
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }

  return [];
}

export function ClassTable({ 
  initialData, 
  masterCertificates,
  masterCompanies = [],
  userProfile = null,
  baseYear,
  graduationYear,
  targetMajor = '',
  displayClass = '',
  selectedGrade = 3,
  adminClassSelector,
}: ClassTableProps) {
  const [selectedStudent, setSelectedStudent] = React.useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  
  const [rankingMap, setRankingMap] = React.useState<Record<string, any>>({})
  const [isRankingsLoading, setIsRankingsLoading] = React.useState(false)

  // 학반 요약 통계 계산
  const stats = React.useMemo(() => {
    const total = initialData.length;
    const employCount = initialData.filter(s => s.career_aspiration === '취업').length;
    const academicCount = initialData.filter(s => s.career_aspiration === '진학').length;
    const certCount = initialData.filter(s => {
      if (Array.isArray(s.certificates) && s.certificates.length > 0) return true;
      if (typeof s.certificates === 'string' && s.certificates.trim()) return true;
      return false;
    }).length;

    const employRate = total > 0 ? Math.round((employCount / total) * 100) : 0;
    const academicRate = total > 0 ? Math.round((academicCount / total) * 100) : 0;

    return { total, employCount, employRate, academicCount, academicRate, certCount };
  }, [initialData]);

  React.useEffect(() => {
    if (!graduationYear) return;
    let isMounted = true;
    setIsRankingsLoading(true);
    fetchYearlyRankings(graduationYear, baseYear || 2026)
      .then(rankings => {
        if (isMounted) {
          setRankingMap(rankings);
          setIsRankingsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to load yearly rankings:', err);
          setIsRankingsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [graduationYear, baseYear]);


  // 현재 데이터로부터 학년 판별
  const currentGrade = React.useMemo(() => {
    if (!initialData || initialData.length === 0) return 3;
    const student = initialData[0];
    if (student.grade) return Number(student.grade);
    const gradYear = student.graduation_year || student.GraduationYear;
    if (!gradYear) return 3;
    const calculatedGrade = 4 - (gradYear - 2026); 
    return Math.max(1, Math.min(3, calculatedGrade)) || 3;
  }, [initialData]);

  // 학과/반 컬럼 동적 노출 여부 판별 (전체 학과/학반 조회 시 노출)
  const isMultiClassView = !targetMajor || targetMajor === 'all' || !displayClass || displayClass === 'all' || displayClass === '전체';

  // 학년에 맞는 컬럼 정의 동적 생성 (항목별 색상 강화)
  const columns: ColumnConfig[] = React.useMemo(() => {
    const prefixCols: ColumnConfig[] = isMultiClassView ? [
      { key: 'major', label: '학과', width: 95, readOnly: true },
      { key: 'class_info', label: '반', width: 40, readOnly: true },
    ] : [];

    const baseCols: ColumnConfig[] = [
      ...prefixCols,
      { key: 'student_number', label: '번호', width: 35, readOnly: true },
      { key: 'student_name', label: '성명', width: 55, readOnly: true },
      { key: 'phone_number', label: '휴대전화번호', width: 105 },
      { 
        key: 'career_aspiration', 
        label: '진로희망', 
        width: 75, 
        type: 'select', 
        options: GET_CAREER_OPTIONS(currentGrade),
        variant: (val) => {
          if (!val) return '';
          if (val.includes('대/공기업') || val.includes('공무원')) return 'bg-blue-50 text-blue-700 border-blue-100';
          if (val.includes('취업') || val === '일반취업') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
          if (val.includes('가업승계')) return 'bg-amber-50 text-amber-700 border-amber-100';
          if (val.includes('진학')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
          if (val.includes('부사관') || val.includes('군특성화')) return 'bg-cyan-50 text-cyan-700 border-cyan-100';
          if (val.includes('아우스빌둥') || val.includes('일학습') || val.includes('맞춤반') || val.includes('기술사관')) return 'bg-purple-50 text-purple-700 border-purple-100';
          return 'bg-slate-50 text-slate-600 border-slate-100';
        }
      },
      { 
        key: 'special_notes', 
        label: '희망기업유형', 
        width: 90, 
        type: 'select',
        options: (rowData) => GET_CAREER_COURSE_OPTIONS(rowData),
        variant: (val) => {
          if (!val) return '';
          if (val === '도제반' || val === '도제') return 'bg-pink-50 text-pink-700 border-pink-100';
          if (val === '청솔반') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
          if (val === '축구부') return 'bg-orange-50 text-orange-700 border-orange-100';
          if (val === '검도부') return 'bg-sky-50 text-sky-700 border-sky-100';
          if (val === '특수교육대상자') return 'bg-slate-100 text-slate-700 border-slate-200';
          if (val === '대/공기업') return 'bg-blue-50 text-blue-700 border-blue-100';
          if (val === '공무원') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
          if (val === '중견/강소기업') return 'bg-orange-50 text-orange-700 border-orange-100';
          if (val === '가업승계') return 'bg-amber-50 text-amber-700 border-amber-100';
          if (val === '부사관') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
          if (val === '아우스빌둥') return 'bg-rose-50 text-rose-700 border-rose-100';
          if (val === '군특성화') return 'bg-teal-50 text-teal-700 border-teal-100';
          if (val === '기술사관') return 'bg-lime-50 text-lime-700 border-lime-100';
          if (val === '운동부') return 'bg-yellow-50 text-yellow-700 border-yellow-100';
          if (val === '기타(직접입력)') return 'bg-violet-50 text-violet-700 border-violet-100';
          return 'bg-slate-50 text-slate-600 border-slate-100';
        }
      },
      { 
        key: 'career_course', 
        label: '희망진로코스', 
        width: 90, 
        type: 'select',
        options: (rowData) => GET_SPECIFIC_COURSE_OPTIONS(rowData),
        variant: (val) => {
          if (!val) return '';
          if (val === '청솔반') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
          if (val === '취업맞춤반') return 'bg-amber-50 text-amber-700 border-amber-100';
          if (val === '중견기업반') return 'bg-orange-50 text-orange-700 border-orange-100';
          if (val === '반도체아카데미반') return 'bg-blue-50 text-blue-700 border-blue-100';
          if (val === '혁신인재반') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
          if (val === '부사관반') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
          if (val === '일학습병행') return 'bg-purple-50 text-purple-700 border-purple-100';
          if (val === '계약학과') return 'bg-purple-50 text-purple-700 border-purple-100';
          if (val === '도제반' || val === '도제') return 'bg-pink-50 text-pink-700 border-pink-100';
          if (val === '아우스빌둥') return 'bg-rose-50 text-rose-700 border-rose-100';
          if (val === '군특성화') return 'bg-teal-50 text-teal-700 border-teal-100';
          if (val === '기술사관') return 'bg-lime-50 text-lime-700 border-lime-100';
          if (val === '운동부') return 'bg-yellow-50 text-yellow-700 border-yellow-100';
          if (val === '기타(직접입력)') return 'bg-violet-50 text-violet-700 border-violet-100';
          return 'bg-slate-50 text-slate-600 border-slate-100';
        }
      },
      { key: 'certificates', label: '취득자격증', width: 110, type: 'multi-select' },
      { 
        key: 'military_status', 
        label: '병역희망', 
        width: 70, 
        type: 'select',
        options: [
          { label: '부사관', value: '부사관' },
          { label: '군입대', value: '군입대' },
          { label: '병역특례', value: '병역특례' },
          { label: '병역면제', value: '병역면제' },
        ],
        variant: (val) => 
          val === '부사관' ? 'bg-blue-50 text-blue-700 border-blue-100' :
          val === '군입대' ? 'bg-slate-50 text-slate-700 border-slate-100' : 
          val === '병역특례' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
          val === '병역면제' ? 'bg-orange-50 text-orange-700 border-orange-100' : ''
      },
      {
        key: 'desired_work_area',
        label: '취업희망지역',
        width: 95,
        type: 'select',
        options: [
          { label: '대구인근', value: '대구인근' },
          { label: '원거리(기숙사)', value: '원거리(기숙사)' },
          { label: '둘다가능', value: '둘다가능' },
        ],
        variant: (val) => val === '대구인근' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : val === '원거리(기숙사)' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : val === '둘다가능' ? 'bg-sky-50 text-sky-700 border-sky-100' : ''
      },
      { 
        key: 'parents_opinion', 
        label: '부모님의견', 
        width: 85,
        type: 'select',
        options: [
          { label: '취업', value: '취업' },
          { label: '진학', value: '진학' },
          { label: '내선택 존중', value: '내선택 존중' },
        ],
        variant: (val) => 
          val === '취업' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
          val === '진학' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
          val === '내선택 존중' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''
      },
    ];

    if (currentGrade === 3) {
      baseCols.push({ key: 'shoe_size', label: '신발', width: 40 });
      baseCols.push({ key: 'top_size', label: '상의', width: 40 });
    }

    baseCols.push({ key: 'personal_remarks', label: '비고', width: 100 });
    baseCols.push({ key: 'counseling_log_action', label: '상담일지', width: 70, type: 'action' });

    return baseCols;
  }, [currentGrade]);

  const groupHeaders = React.useMemo(() => [
    { label: '학생 기본 정보', colSpan: isMultiClassView ? 5 : 3, className: 'bg-slate-100 text-slate-900 text-[11px]' },
    { label: '희망 기업유형 및 진로코스', colSpan: 3, className: 'bg-blue-50 text-blue-900 text-[11px]' },
    { label: '취득 자격', colSpan: 1, className: 'bg-amber-50 text-amber-900 text-[11px]' },
    { label: '취업 상세 및 의견', colSpan: 3, className: 'bg-emerald-50 text-emerald-900 text-[11px]' },
    { 
      label: '피복 및 비고', 
      colSpan: currentGrade === 3 ? 3 : 1,
      className: 'bg-slate-50 text-slate-700 text-[11px]' 
    },
    { label: '기록', colSpan: 1, className: 'bg-indigo-50 text-indigo-900 text-[11px]' },
  ], [currentGrade, isMultiClassView]);

  const handleSave = React.useCallback(async (id: string, field: string, value: any) => {
    return await updatePersonalDetail(id, field, value)
  }, []);

  const handleBulkSave = React.useCallback(async (updates: any[]) => {
    return await bulkUpdatePersonalDetails(updates)
  }, []);

  const handleAction = React.useCallback((id: string, key: string) => {
    if (key === 'counseling_log_action') {
      const student = initialData.find(s => s.id === id)
      if (student) { setSelectedStudent(student); setIsModalOpen(true); }
    }
  }, [initialData]);

  return (
    <div className="w-full flex flex-col gap-2.5 sm:gap-3 min-h-0 flex-1 h-[calc(100dvh-150px)] lg:h-[calc(100vh-115px)] max-h-[calc(100dvh-150px)] lg:max-h-[calc(100vh-115px)] overflow-hidden">
      {/* 요약 통계 카드 4종 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">학반 학생수</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.total}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">취업 희망</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-blue-600">{stats.employCount}명</span>
                <span className="text-xs font-bold text-slate-400">({stats.employRate}%)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Briefcase className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">진학 희망</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-600">{stats.academicCount}명</span>
                <span className="text-xs font-bold text-slate-400">({stats.academicRate}%)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">자격증 취득 학생</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-amber-600">{stats.certCount}명</span>
                <span className="text-xs font-bold text-slate-400">({stats.total > 0 ? Math.round((stats.certCount / stats.total) * 100) : 0}%)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 학반 선택기 (드롭다운 필터 바) */}
      {adminClassSelector && (
        <div className="shrink-0">
          {adminClassSelector}
        </div>
      )}

      {/* 스프레드시트 메인 테이블 카드 */}
      <Card className="flex-1 min-h-0 shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden flex flex-col mb-0">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <StandardSpreadsheetTable 
            data={initialData}
            columns={columns}
            groupHeaders={groupHeaders}
            onSave={handleSave}
            onBulkSave={handleBulkSave}
            onAction={handleAction}
            searchPlaceholder="학반 학생 검색 (이름, 번호, 진로희망...)"
            masterCertificates={masterCertificates}
            masterCompanies={masterCompanies}
            rankingMap={rankingMap}
            isRankingsLoading={isRankingsLoading}
            userProfile={userProfile}
            baseYear={baseYear}
            pageType="class-management"
          />
        </CardContent>
      </Card>

      <CounselingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
      />
    </div>
  )
}

