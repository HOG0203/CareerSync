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
} from 'lucide-react';
import { StudentTable } from './student-table';
import { ImportButton } from './import-button';
import { ExportButton } from './export-button';
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions';
import { getMajorOrderIndex } from '@/lib/student-utils';

interface StudentsHubClientProps {
  initialData: any[];
  isAdmin: boolean;
  masterCertificates: MasterCertificate[];
  masterCompanies?: any[];
  rankingMap: Record<string, any>;
  userProfile: any;
  baseYear: number;
  currentAY: number;
  grade: number;
  selectedYear: string;
  academicYears: number[];
}

export function StudentsHubClient({
  initialData,
  isAdmin,
  masterCertificates,
  masterCompanies = [],
  rankingMap,
  userProfile,
  baseYear,
  currentAY,
  grade,
  selectedYear,
  academicYears,
}: StudentsHubClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [selectedClass, setSelectedClass] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');

  const handleAYChange = (newAYStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const newAY = parseInt(newAYStr);
    const gradYear = newAY + (4 - grade);
    params.set('ay', newAYStr);
    params.set('grade', String(grade));
    params.set('year', String(gradYear));
    router.push(`/students?${params.toString()}`);
  };

  const handleGradeChange = (newGradeStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const newGrade = parseInt(newGradeStr);
    const gradYear = currentAY + (4 - newGrade);
    params.set('ay', String(currentAY));
    params.set('grade', newGradeStr);
    params.set('year', String(gradYear));
    router.push(`/students?${params.toString()}`);
  };

  const [sheetFilteredData, setSheetFilteredData] = React.useState<any[] | null>(null);

  // 학사 학년도나 학년 변경 시에만 시트 필터 상태 초기화
  React.useEffect(() => {
    setSheetFilteredData(null);
  }, [grade, currentAY]);

  const handleFilteredDataChange = React.useCallback((data: any[] | null) => {
    setSheetFilteredData(data);
  }, []);

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


  // 3. 취업 현황 옵션
  const statusOptions = [
    { label: '전체 취업현황', value: 'all' },
    { label: '취업', value: '취업' },
    { label: '채용진행중', value: '채용진행중' },
    { label: '현장실습중', value: '현장실습중' },
    { label: '도제OJT', value: '도제OJT' },
    { label: '미취업', value: '미취업' },
    { label: '제외인정자', value: '제외인정자' },
  ];

  // 학과 변경 시 반 필터 유효성 검사
  React.useEffect(() => {
    if (selectedClass !== 'all' && !classOptions.includes(selectedClass)) {
      setSelectedClass('all');
    }
  }, [selectedMajor, classOptions, selectedClass]);

  // 4. 상위 필터링된 데이터 (학과, 반, 취업현황 등 구조적 필터링, 검색어는 시트 내장 엔진으로 0ms 즉각 처리)
  const filteredData = React.useMemo(() => {
    return initialData.filter((student) => {
      if (selectedMajor !== 'all' && student.major !== selectedMajor) return false;
      if (selectedClass !== 'all' && student.class_info !== selectedClass) return false;
      if (selectedStatus !== 'all' && (student.business_type || '미취업') !== selectedStatus) return false;
      return true;
    });
  }, [initialData, selectedMajor, selectedClass, selectedStatus]);


  // 상위 필터 + 아래 시트 열 필터가 모두 반영된 최종 실시간 유효 데이터
  const effectiveData = sheetFilteredData !== null ? sheetFilteredData : filteredData;

  // 5. 핵심 요약 통계 계산 (시트 열 필터까지 100% 실시간 연동!)
  const stats = React.useMemo(() => {
    const total = effectiveData.length;
    // 취업현황에서 '취업'인 학생수
    const employedCount = effectiveData.filter((s) => s.business_type === '취업').length;
    // 제외인정자수 (취업현황 또는 진로희망이 제외인정자인 학생)
    const excludedCount = effectiveData.filter(
      (s) => s.business_type === '제외인정자' || s.career_aspiration === '제외인정자'
    ).length;
    // 유효 모수 (전체 학생수 - 제외인정자수)
    const validDenominator = Math.max(0, total - excludedCount);
    const employmentRate = validDenominator > 0 
      ? Math.round((employedCount / validDenominator) * 100) 
      : 0;

    const trainingCount = effectiveData.filter(
      (s) => s.has_field_training === 'O' || (s.training_records && s.training_records.length > 0) || s.latest_training_company
    ).length;

    // 취업희망자 중 취업현황이 빈칸(공란) 또는 미취업인 학생 (취업희망 '아니오' 제외)
    const seekingUnemployedCount = effectiveData.filter((s) => {
      const isBlankOrUnemployed = !s.business_type || s.business_type === '미취업' || s.business_type === '아니오';
      const isNotDesiring = s.is_desiring_employment === '아니오';
      return isBlankOrUnemployed && !isNotDesiring;
    }).length;

    return { total, employedCount, excludedCount, validDenominator, trainingCount, seekingUnemployedCount, employmentRate };
  }, [effectiveData]);


  return (
    <div className="flex flex-col h-auto min-h-full max-h-none overflow-visible lg:h-[calc(100vh-115px)] lg:max-h-[calc(100vh-115px)] lg:min-h-0 lg:overflow-hidden gap-2.5 pb-12 lg:pb-0">
      {/* 1. 상단 취업·실습 요약 통계 카드 4종 (student-accounts 스타일) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">조회 학생수</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.total}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">취업 ({stats.employmentRate}%)</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{stats.employedCount}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">현장실습 참여</p>
              <p className="text-xl sm:text-2xl font-black text-blue-600 mt-0.5">{stats.trainingCount}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500">미연계 학생</p>
              <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{stats.seekingUnemployedCount}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <HelpCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

      </div>


      {/* 2. 모던 통합 필터 & 검색 & 툴바 (student-accounts 스타일) */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0">
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between flex-wrap">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              {/* 학년도 셀렉트 (선택 시 즉각 해당 학사년도 데이터로 전환) */}
              <Select value={String(currentAY)} onValueChange={handleAYChange}>
                <SelectTrigger className="w-[110px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  <SelectValue placeholder="학년도" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {academicYears.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs font-bold text-slate-800">
                      {y}학년도
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 학년 셀렉트 (선택 시 즉각 해당 학년 데이터로 전환) */}
              <Select value={String(grade)} onValueChange={handleGradeChange}>
                <SelectTrigger className="w-[95px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  <SelectValue placeholder="학년" />
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
                <SelectTrigger className="w-[100px] h-9 text-xs font-bold rounded-xl border-slate-200">
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

              {/* 취업 현황 셀렉트 */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[130px] h-9 text-xs font-bold rounded-xl border-slate-200">
                  <SelectValue placeholder="취업현황" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 우측 검색창 및 가져오기/내보내기 액션 버튼 */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="이름, 번호, 회사명, 자격증..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl border-slate-200"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ImportButton defaultMode="comprehensive" />
                <ExportButton
                  data={effectiveData}
                  filename={`${parseInt(selectedYear) - 1}학년도_${grade}학년_취업실습종합현황_${new Date().toLocaleDateString()}.csv`}
                  type="comprehensive"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. 핵심 시트 영역 (엑셀식 셀 즉각 편집 & Ctrl+C/V & 키보드 이동 100% 보존) */}
      <Card className="h-auto overflow-visible lg:flex-1 lg:min-h-0 lg:overflow-hidden shadow-sm border border-slate-200/80 bg-white flex flex-col rounded-2xl min-w-full mb-0">
        <CardContent className="h-auto overflow-visible lg:flex-1 lg:overflow-hidden p-0 relative flex flex-col lg:min-h-0">
          <div className="w-full h-auto lg:h-full flex flex-col lg:min-h-0">
            <StudentTable
              initialData={filteredData}
              isAdmin={isAdmin}
              masterCertificates={masterCertificates}
              masterCompanies={masterCompanies}
              rankingMap={rankingMap}
              userProfile={userProfile}
              baseYear={baseYear}
              graduationYear={selectedYear}
              externalSearchTerm={searchTerm}
              onFilteredDataChange={handleFilteredDataChange}
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
