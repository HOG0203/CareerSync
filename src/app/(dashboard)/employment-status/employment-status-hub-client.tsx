'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  CheckCircle2,
  Building2,
  HelpCircle,
  Search,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  X,
  Loader2,
  Landmark,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentEmploymentData } from '@/lib/data';
import { EmploymentStatusGrid, CustomRule } from './employment-status-grid';
import { CustomCombinationModal } from './custom-combination-modal';
import { getMajorOrderIndex } from '@/lib/student-utils';
import { cn } from '@/lib/utils';


interface EmploymentStatusHubClientProps {
  initialData: StudentEmploymentData[];
  userProfile: any;
  teacherProfiles: any[];
  baseYear: number;
  currentAY: number;
  grade: number;
  selectedYear: string;
  academicYears: number[];
}

export function EmploymentStatusHubClient({
  initialData,
  userProfile,
  teacherProfiles,
  baseYear,
  currentAY,
  grade,
  selectedYear,
  academicYears,
}: EmploymentStatusHubClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 서버 라우팅 상태 및 전환 피드백
  const [isRouting, startRouting] = React.useTransition();
  const [loadingTargetText, setLoadingTargetText] = React.useState<string>('');

  const [localSearchTerm, setLocalSearchTerm] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [, startSearchTransition] = React.useTransition();

  const handleSearchChange = React.useCallback((val: string) => {
    setLocalSearchTerm(val);
    startSearchTransition(() => {
      setSearchQuery(val);
    });
  }, []);

  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [selectedClass, setSelectedClass] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');

  // 자유 커스텀 조건 조합 검색 상태
  const [customRule, setCustomRule] = React.useState<CustomRule | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = React.useState(false);

  // 전체 데이터에서 고유 자격증 목록 추출 (모달 자동완성 힌트용)
  const allCertificates = React.useMemo(() => {
    const certSet = new Set<string>();
    initialData.forEach((s) => {
      const certs = Array.isArray(s.certificates)
        ? s.certificates
        : (typeof s.certificates === 'string' ? [s.certificates] : []);
      certs.forEach((c) => {
        if (c && c.trim()) certSet.add(c.trim());
      });
    });
    return Array.from(certSet).sort();
  }, [initialData]);

  const isLowerGrade = grade === 1 || grade === 2;

  // 학년도 변경 핸들러 (스마트 로딩 피드백 연동)
  const handleAYChange = (newAYStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const newAY = parseInt(newAYStr);
    const gradYear = newAY + (4 - grade);
    params.set('ay', newAYStr);
    params.set('grade', String(grade));
    params.set('year', String(gradYear));
    setLoadingTargetText(`${newAYStr}학년도 ${grade}학년 데이터 불러오는 중...`);
    startRouting(() => {
      router.push(`/employment-status?${params.toString()}`);
    });
  };

  // 학년 변경 핸들러 (스마트 로딩 피드백 연동)
  const handleGradeChange = (newGradeStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const newGrade = parseInt(newGradeStr);
    const gradYear = currentAY + (4 - newGrade);
    params.set('ay', String(currentAY));
    params.set('grade', newGradeStr);
    params.set('year', String(gradYear));
    setLoadingTargetText(`${currentAY}학년도 ${newGradeStr}학년 데이터 불러오는 중...`);
    startRouting(() => {
      router.push(`/employment-status?${params.toString()}`);
    });
  };


  // 1. 학과 옵션 추출 (공식 순서 정렬)
  const majorOptions = React.useMemo(() => {
    const set = new Set<string>();
    initialData.forEach((s) => {
      if (s.major && s.major.trim()) set.add(s.major.trim());
    });
    return Array.from(set).sort((a, b) => {
      const orderA = getMajorOrderIndex(a);
      const orderB = getMajorOrderIndex(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'ko');
    });
  }, [initialData]);

  // 2. 반 옵션 추출
  const classOptions = React.useMemo(() => {
    const set = new Set<string>();
    initialData.forEach((s) => {
      if (selectedMajor !== 'all' && s.major !== selectedMajor) return;
      if (s.class_info) set.add(s.class_info);
    });
    return Array.from(set).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
  }, [initialData, selectedMajor]);

  // 3. 상태 옵션 목록 (3학년 vs 1,2학년 분기)
  const statusOptions = React.useMemo(() => {
    if (isLowerGrade) {
      return [
        { label: '전체 진로희망', value: 'all' },
        { label: '취업', value: '취업' },
        { label: '진학', value: '진학' },
        { label: '제외인정자', value: '제외인정자' },
        { label: '미정/미입력', value: '미정' },
      ];
    }
    return [
      { label: '전체 취업현황', value: 'all' },
      { label: '취업', value: '취업' },
      { label: '채용진행중', value: '채용진행중' },
      { label: '현장실습중', value: '현장실습중' },
      { label: '도제OJT', value: '도제OJT' },
      { label: '미취업', value: '미취업' },
      { label: '제외인정자', value: '제외인정자' },
    ];
  }, [isLowerGrade]);

  // 학과 변경 시 반 필터 유효성 검사
  React.useEffect(() => {
    if (selectedClass !== 'all' && !classOptions.includes(selectedClass)) {
      setSelectedClass('all');
    }
  }, [selectedMajor, classOptions, selectedClass]);

  // 4. 실시간 인메모리 필터링된 데이터 (학과, 반, 상태 필터 적용 시 목록 축소, 키워드 검색 시에는 바둑판 구조 유지)
  const filteredData = React.useMemo(() => {
    return initialData.filter((student) => {
      if (selectedMajor !== 'all' && student.major !== selectedMajor) return false;
      if (selectedClass !== 'all' && student.class_info !== selectedClass) return false;

      if (selectedStatus !== 'all') {
        if (isLowerGrade) {
          const asp = student.career_aspiration || '미정';
          if (selectedStatus === '미정') {
            if (student.career_aspiration && student.career_aspiration !== '미정') return false;
          } else if (asp !== selectedStatus) {
            return false;
          }
        } else {
          const status = student.business_type || '미취업';
          if (status !== selectedStatus) return false;
        }
      }

      return true;
    });
  }, [initialData, selectedMajor, selectedClass, selectedStatus, isLowerGrade]);


  // 5. 핵심 요약 통계 계산
  const stats = React.useMemo(() => {
    const total = filteredData.length;

    if (isLowerGrade) {
      // 1, 2학년 진로희망 통계
      const employmentHopeCount = filteredData.filter((s) => s.career_aspiration === '취업').length;
      const collegeHopeCount = filteredData.filter((s) => s.career_aspiration === '진학').length;
      const excludedHopeCount = filteredData.filter((s) => s.career_aspiration === '제외인정자').length;
      const undecidedCount = filteredData.filter((s) => !s.career_aspiration || s.career_aspiration === '미정').length;

      const validDenominator = Math.max(0, total - excludedHopeCount);
      const hopeRate = validDenominator > 0 ? Math.round((employmentHopeCount / validDenominator) * 100) : 0;

      return {
        total,
        primaryCount: employmentHopeCount,
        primaryRate: hopeRate,
        secondaryCount: collegeHopeCount,
        tertiaryCount: undecidedCount,
        majorCompanyCount: 0,
        midCompanyCount: 0,
        excludedCount: excludedHopeCount,
      };
    } else {
      // 3학년 취업 통계
      const employedCount = filteredData.filter((s) => s.business_type === '취업').length;
      const excludedCount = filteredData.filter(
        (s) => s.business_type === '제외인정자' || s.career_aspiration === '제외인정자'
      ).length;
      const validDenominator = Math.max(0, total - excludedCount);
      const employmentRate = validDenominator > 0 ? Math.round((employedCount / validDenominator) * 100) : 0;

      // 대기업 / 공기업 / 공무원 취업자수
      const majorCompanyCount = filteredData.filter(
        (s) => s.business_type === '취업' && ['대기업', '공기업', '공무원'].includes(s.company_type || '')
      ).length;

      // 중견기업 취업자수
      const midCompanyCount = filteredData.filter(
        (s) => s.business_type === '취업' && (s.company_type === '중견기업' || s.company_type === '중견')
      ).length;

      return {
        total,
        primaryCount: employedCount,
        primaryRate: employmentRate,
        majorCompanyCount,
        midCompanyCount,
        excludedCount,
      };
    }
  }, [filteredData, isLowerGrade]);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 상단 4종 핵심 요약 통계 카드 */}
      <div 
        key={`stats-${currentAY}-${grade}-${selectedMajor}-${selectedClass}-${selectedStatus}`} 
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200"
      >
        {/* 카드 1: 조회 학생수 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">조회 학생수</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total}</span>
                <span className="text-xs font-bold text-slate-500">명</span>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 3학년 취업률 / 1,2학년 취업희망률 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">
                {isLowerGrade ? '취업 희망 (희망률)' : '취업 확정·진행 (취업률)'}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                  {stats.primaryRate}%
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ({stats.primaryCount}명)
                </span>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 3학년 대·공기업·공직 취업 (범례: rose-600) / 1,2학년 진학 희망 (범례: rose-500) */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">
                {isLowerGrade ? '진학 희망' : '대·공기업·공직 취업'}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-rose-600">
                  {isLowerGrade ? stats.secondaryCount : stats.majorCompanyCount}
                </span>
                <span className="text-xs font-bold text-slate-500">명</span>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 shrink-0">
              <Landmark className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 4: 3학년 중견기업 취업 (범례: purple-600) / 1,2학년 진로 미정 (범례: slate) */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">
                {isLowerGrade ? '진로 미정' : '중견기업 취업'}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className={cn(
                  "text-2xl sm:text-3xl font-black",
                  isLowerGrade ? "text-slate-600" : "text-purple-600"
                )}>
                  {isLowerGrade ? stats.tertiaryCount : stats.midCompanyCount}
                </span>
                <span className="text-xs font-bold text-slate-500">명</span>
              </div>
            </div>
            <div className={cn(
              "h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center shrink-0 border",
              isLowerGrade 
                ? "bg-slate-50 text-slate-600 border-slate-200" 
                : "bg-purple-50 text-purple-600 border-purple-100"
            )}>
              {isLowerGrade ? <HelpCircle className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* 2. 모던 통합 필터 & 검색 & 범례 툴바 (admin/students 디자인) */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0">
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex flex-col lg:flex-row gap-2.5 items-center justify-between flex-wrap">
            {/* 좌측: 필터 셀렉트 그룹 */}
            <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
              {/* 학년도 셀렉트 */}
              <Select value={String(currentAY)} onValueChange={handleAYChange} disabled={isRouting}>
                <SelectTrigger className="w-[115px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  {isRouting ? (
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{currentAY}학년도</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="학년도" />
                  )}
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {academicYears.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs font-bold text-slate-800">
                      {y}학년도
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 학년 셀렉트 */}
              <Select value={String(grade)} onValueChange={handleGradeChange} disabled={isRouting}>
                <SelectTrigger className="w-[100px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  {isRouting ? (
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{grade}학년</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="학년" />
                  )}
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="3" className="text-xs font-bold text-slate-800">3학년</SelectItem>
                  <SelectItem value="2" className="text-xs font-bold text-slate-800">2학년</SelectItem>
                  <SelectItem value="1" className="text-xs font-bold text-slate-800">1학년</SelectItem>
                </SelectContent>
              </Select>


              {/* 학과 셀렉트 */}
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                <SelectTrigger className="w-[130px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  <SelectValue placeholder="학과" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">전체 학과</SelectItem>
                  {majorOptions.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs font-medium">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 반 셀렉트 */}
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-[95px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  <SelectValue placeholder="반" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">전체 반</SelectItem>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs font-medium">
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 상태 셀렉트 */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[125px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 자유 커스텀 조건 조합 검색 버튼 */}
              <Button
                type="button"
                variant={customRule ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsCustomModalOpen(true)}
                className={cn(
                  'h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all',
                  customRule 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs' 
                    : 'border-slate-200 hover:border-purple-300 text-purple-700 bg-purple-50/50 hover:bg-purple-50'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                조건 조합 검색
              </Button>

              {/* 조건 조합 활성화 시 배지 및 초기화 버튼 */}
              {customRule && (
                <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                  <span className="text-[11px] font-bold text-purple-800">
                    ✨ {customRule.presetName ? `"${customRule.presetName}"` : `${customRule.conditions.length}개 조건 조합`} 강조 중
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomRule(null)}
                    className="p-0.5 hover:bg-purple-200 rounded-full transition-colors text-purple-600"
                    title="조건 조합 해제"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

            </div>

            {/* 우측: 실시간 검색창 및 범례 */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="이름, 자격증, 회사명..."
                  value={localSearchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 pr-7 h-9 text-xs rounded-xl border-slate-200"
                />
                {localSearchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* 컬러 범례 미니 칩 (바둑판 셀 색상과 1:1 완벽 일치) */}
              {isLowerGrade ? (
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[10px] font-bold whitespace-nowrap">
                  <span className="flex items-center justify-center bg-emerald-500 text-white px-2 py-0.5 rounded shadow-2xs">
                    취업
                  </span>
                  <span className="flex items-center justify-center bg-rose-500 text-white px-2 py-0.5 rounded shadow-2xs">
                    진학
                  </span>
                  <span className="flex items-center justify-center bg-slate-400 text-white px-2 py-0.5 rounded shadow-2xs">
                    제외인정자
                  </span>
                  <span className="flex items-center justify-center bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                    미정
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[10px] font-bold whitespace-nowrap">
                  <span className="flex items-center justify-center bg-rose-600 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    대/공기업
                  </span>
                  <span className="flex items-center justify-center bg-indigo-700 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    공무원/부사관
                  </span>
                  <span className="flex items-center justify-center bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    중견기업
                  </span>
                  <span className="flex items-center justify-center bg-cyan-500 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    강소기업
                  </span>
                  <span className="flex items-center justify-center bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    연계교육
                  </span>
                  <span className="flex items-center justify-center bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    기타
                  </span>
                  <span className="flex items-center justify-center bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs">
                    채용진행중
                  </span>
                </div>
              )}


            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. 학급별 바둑판 그리드 뷰 (EmploymentStatusGrid 연동) */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl overflow-hidden relative min-h-[400px]">
        {/* 서버 라우팅 중일 때 표시되는 스마트 블러 오버레이 로더 */}
        {isRouting && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-3 rounded-2xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-xl text-xs font-bold animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span>{loadingTargetText || '데이터를 불러오는 중...'}</span>
            </div>
          </div>
        )}

        <CardContent className="p-3 sm:p-4">
          <div key={`${currentAY}-${grade}-${selectedMajor}-${selectedClass}-${selectedStatus}`} className="animate-in fade-in duration-200">
            <EmploymentStatusGrid
              allData={filteredData}
              userProfile={userProfile}
              teacherProfiles={teacherProfiles}
              baseYear={currentAY}
              grade={grade}
              graduationYear={selectedYear}
              hideSearchHeader={true}
              externalSearchQuery={searchQuery}
              externalCustomRule={customRule}
            />
          </div>
        </CardContent>
      </Card>

      {/* 자유 커스텀 조건 조합 모달 */}
      <CustomCombinationModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onApply={(rule) => setCustomRule(rule)}
        currentRule={customRule}
        allCertificates={allCertificates}
      />
    </div>
  );
}


