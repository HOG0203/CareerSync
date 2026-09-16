'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Users,
  Building2,
  Trophy,
  Target,
  Search,
  School,
  FileSpreadsheet,
  Download,
  Edit2,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentEmploymentData } from '@/lib/data';
import { ExcelImportModal } from './excel-import-modal';
import { AdmissionEditModal } from './admission-edit-modal';
import { AdmissionSpreadsheetTable } from './admission-spreadsheet-table';
import { batchUpdateMultipleStudentsInlineAction } from './actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface MiddleSchoolEmploymentClientProps {
  initialStudents: StudentEmploymentData[];
  baseYear: number;
  userProfile?: any;
}

export function MiddleSchoolEmploymentClient({
  initialStudents,
  baseYear,
  userProfile,
}: MiddleSchoolEmploymentClientProps) {
  const router = useRouter();

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedMiddleSchool, setSelectedMiddleSchool] = React.useState<string>('all');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [selectedCompanyType, setSelectedCompanyType] = React.useState<string>('all');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'manage' | 'spreadsheet'>('overview');

  // 모달 상태
  const [isExcelModalOpen, setIsExcelModalOpen] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<StudentEmploymentData | null>(null);

  // 인라인 직접 편집 상태: { [studentId: string]: { middle_school?: string; admission_rank_percentile?: string; admission_score?: string; admission_type?: string } }
  const [inlineEdits, setInlineEdits] = React.useState<Record<string, Record<string, string>>>({});
  const [isSavingInline, setIsSavingInline] = React.useState(false);

  const handleInlineChange = (studentId: string, field: string, value: string) => {
    setInlineEdits((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: value,
      },
    }));
  };

  const handleResetInlineChanges = () => {
    setInlineEdits({});
  };

  const handleSaveInlineChanges = async () => {
    const studentIds = Object.keys(inlineEdits);
    if (studentIds.length === 0) return;

    setIsSavingInline(true);
    try {
      const updates = studentIds.map((id) => {
        const data = inlineEdits[id];
        return {
          id,
          middle_school: data.middle_school !== undefined ? data.middle_school : undefined,
          admission_rank_percentile:
            data.admission_rank_percentile !== undefined
              ? data.admission_rank_percentile === ''
                ? null
                : parseFloat(data.admission_rank_percentile)
              : undefined,
          admission_type: data.admission_type !== undefined ? data.admission_type : undefined,
        };
      });

      const res = await batchUpdateMultipleStudentsInlineAction(updates);
      if (res.success) {
        setInlineEdits({});
        alert(`총 ${res.count}명의 학생 입학정보가 저장되었습니다.`);
        router.refresh();
      } else {
        alert(res.error || '저장 중 오류가 발생했습니다.');
      }
    } catch (e: any) {
      alert(e.message || '저장 중 예외가 발생했습니다.');
    } finally {
      setIsSavingInline(false);
    }
  };

  const inlineModifiedCount = Object.keys(inlineEdits).length;
  const hasInlineChanges = inlineModifiedCount > 0;

  // 등록된 모든 중학교 목록 추출 (중복 제거 및 가나다 정렬)
  const allMiddleSchools = React.useMemo(() => {
    const set = new Set<string>();
    initialStudents.forEach((s) => {
      if (s.middle_school && s.middle_school.trim()) {
        set.add(s.middle_school.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [initialStudents]);

  // 학과 목록 추출
  const allMajors = React.useMemo(() => {
    const set = new Set<string>();
    initialStudents.forEach((s) => {
      if (s.major && s.major.trim()) set.add(s.major.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [initialStudents]);

  const isSearching = Boolean(
    (selectedMiddleSchool && selectedMiddleSchool !== 'all') || searchTerm.trim()
  );

  // 필터링된 학생 데이터
  const filteredStudents = React.useMemo(() => {
    if (!isSearching) return [];

    return initialStudents.filter((student) => {
      // 중학교 필터 (유연한 상호 포함 및 공백 제거 매칭)
      if (selectedMiddleSchool !== 'all') {
        const studentSchool = (student.middle_school || '').trim().toLowerCase();
        const filterSchool = selectedMiddleSchool.trim().toLowerCase();
        if (!studentSchool || (!studentSchool.includes(filterSchool) && !filterSchool.includes(studentSchool))) {
          return false;
        }
      }

      // 학과 필터
      if (selectedMajor !== 'all' && student.major !== selectedMajor) {
        return false;
      }

      // 기업 구분 필터
      if (selectedCompanyType !== 'all') {
        const cType = (student.company_type || '').trim();
        if (selectedCompanyType === '우수기업') {
          if (!['대기업', '공기업', '공무원'].includes(cType)) return false;
        } else if (cType !== selectedCompanyType) {
          return false;
        }
      }

      // 텍스트 검색 (이름, 출신중학교, 회사명, 자격증 등)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const searchStr = `${student.student_name || ''} ${student.student_number || ''} ${student.middle_school || ''} ${student.company || ''} ${student.latest_training_company || ''} ${student.major || ''} ${student.class_info || ''}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }

      return true;
    });
  }, [initialStudents, selectedMiddleSchool, selectedMajor, selectedCompanyType, searchTerm, isSearching]);

  // 상단 4대 핵심 통계 카드 계산
  const stats = React.useMemo(() => {
    const totalStudents = filteredStudents.length;

    // 취업자 수 및 취업률 (취업 또는 재직자)
    const employedStudents = filteredStudents.filter((s) => {
      const bType = s.business_type || '';
      const status = s.employment_status || '';
      return bType === '취업' || status === '취업';
    });
    const employedCount = employedStudents.length;

    // 제외인정자 제외 유효 분모
    const excludedCount = filteredStudents.filter(
      (s) => s.business_type === '제외인정자' || s.career_aspiration === '제외인정자'
    ).length;
    const validDenominator = Math.max(0, totalStudents - excludedCount);
    const employmentRate = validDenominator > 0 ? Math.round((employedCount / validDenominator) * 100) : 0;

    // 🏆 우수 기업(대기업·공기업·공무원) 취업자 수 및 비율
    const topCorporateStudents = filteredStudents.filter((s) => {
      const isEmployed = s.business_type === '취업' || s.employment_status === '취업';
      const cType = s.company_type || '';
      return isEmployed && ['대기업', '공기업', '공무원'].includes(cType);
    });
    const topCorporateCount = topCorporateStudents.length;
    const topCorporateRate = validDenominator > 0 ? Math.round((topCorporateCount / validDenominator) * 100) : 0;

    // 평균 입학 석차 백분율
    const validRankPercentiles = filteredStudents
      .map((s) => (s.admission_rank_percentile !== undefined && s.admission_rank_percentile !== null ? parseFloat(String(s.admission_rank_percentile)) : null))
      .filter((p): p is number => p !== null && !isNaN(p));

    const avgRankPercentile =
      validRankPercentiles.length > 0
        ? Math.round((validRankPercentiles.reduce((a, b) => a + b, 0) / validRankPercentiles.length) * 10) / 10
        : null;

    return {
      totalStudents,
      employedCount,
      employmentRate,
      topCorporateCount,
      topCorporateRate,
      avgRankPercentile,
    };
  }, [filteredStudents]);

  // 엑셀 다운로드 핸들러
  const handleExportExcel = () => {
    const exportData = filteredStudents.map((s, idx) => ({
      '연번': idx + 1,
      '졸업년도': s.graduation_year ? `${s.graduation_year}년도` : '-',
      '학번': s.student_number || '',
      '성명': s.student_name,
      '학과': s.major || '',
      '반': s.class_info ? `${s.class_info}반` : '',
      '출신중학교': s.middle_school || '미입력',
      '입학석차백분율(%)': s.admission_rank_percentile !== undefined && s.admission_rank_percentile !== null ? `${s.admission_rank_percentile}%` : '-',
      '전형구분': s.admission_type || '-',
      '취업현황': s.business_type || s.employment_status || '미취업',
      '취업처(기업명)': s.company || s.latest_training_company || '-',
      '기업구분': s.company_type || '-',
      '현장실습처': s.latest_training_company || '-',
      '비고': s.remarks || s.special_notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const sheetTitle = selectedMiddleSchool !== 'all' ? `${selectedMiddleSchool}_취업현황` : '중학교별_취업현황';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    XLSX.writeFile(wb, `${sheetTitle}_전체학생.xlsx`);
  };

  return (
    <div className="flex flex-col gap-5 p-3 sm:p-6 max-w-7xl mx-auto w-full animate-in fade-in duration-150">
      {/* 1. 상단 페이지 타이틀 및 액션 버튼 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0 shadow-xs">
            <School className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                중학교별 취업현황
              </h1>
              <Badge variant="secondary" className="text-[11px] font-bold bg-teal-50 text-teal-700 border-teal-200">
                입학지원
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              출신 중학교별 취업처 현황과 입학 전형 성적을 매칭하여 입학 설명회 및 진로 상담 자료로 활용합니다.
            </p>
          </div>
        </div>

        {/* 우측 엑셀 내보내기 및 엑셀 일괄 등록 버튼 */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* 엑셀 다운로드 버튼 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-9 px-3 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            엑셀 내보내기
          </Button>

          {/* 엑셀 일괄 등록 버튼 */}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsExcelModalOpen(true)}
            className="h-9 px-3.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            엑셀 일괄 등록
          </Button>
        </div>
      </div>

      {/* 2. 상단 4대 핵심 요약 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 카드 1: 해당 중학교 학생 수 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">
                {selectedMiddleSchool !== 'all' ? `${selectedMiddleSchool} 출신` : '조회 학생수'}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {stats.totalStudents}
                </span>
                <span className="text-xs font-bold text-slate-500">명</span>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 취업률 (취업 확정 인원) */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">취업 확정 (취업률)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                  {stats.employmentRate}%
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ({stats.employedCount}명)
                </span>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 🏆 우수 기업(대기업·공기업·공무원) 취업 성과 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">
                우수 기업 (대·공기업·공무원)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-purple-700">
                  {stats.topCorporateCount}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  명 ({stats.topCorporateRate}%)
                </span>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 4: 평균 입학성적 (석차 백분율) */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">평균 입학 성적 (석차)</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {stats.avgRankPercentile !== null ? `상위 ${stats.avgRankPercentile}` : '-'}
                </span>
                {stats.avgRankPercentile !== null && <span className="text-xs font-bold text-slate-500">%</span>}
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 모드 탭 스위처 바 */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Building2 className="h-4 w-4 text-teal-600" />
          중학교별 취업현황 조회
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('spreadsheet')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'spreadsheet'
              ? 'bg-purple-600 text-white shadow-2xs font-black'
              : 'text-purple-700 hover:bg-purple-50'
          )}
        >
          <FileSpreadsheet className="h-4 w-4 text-purple-200" />
          📊 스프레드시트 일괄 편집
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manage')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
            activeTab === 'manage'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Edit2 className="h-4 w-4 text-blue-600" />
          출신교 및 성적 목록 수정
        </button>
      </div>

      {activeTab === 'spreadsheet' ? (
        <AdmissionSpreadsheetTable
          students={initialStudents}
          baseYear={baseYear}
          onRefreshData={() => router.refresh()}
        />
      ) : (
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* 상단 필터 바 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">

            {/* 출신 중학교 빠른 선택 칩 (전체, 옥천중, 옥천여중 등) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">빠른 중학교:</span>
              <button
                type="button"
                onClick={() => setSelectedMiddleSchool('all')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all',
                  selectedMiddleSchool === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                전체 ({allMiddleSchools.length}개교)
              </button>
              {allMiddleSchools.slice(0, 7).map((sch) => (
                <button
                  key={sch}
                  type="button"
                  onClick={() => setSelectedMiddleSchool(sch)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all',
                    selectedMiddleSchool === sch
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100/80 border border-teal-200/50'
                  )}
                >
                  {sch}
                </button>
              ))}
            </div>
          </div>

          {/* 다중 필터 및 검색 인풋 */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* 중학교 전체 드롭다운 */}
              <Select value={selectedMiddleSchool} onValueChange={setSelectedMiddleSchool}>
                <SelectTrigger className="w-[155px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="출신 중학교 전체" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[280px]">
                  <SelectItem value="all" className="text-xs font-bold">전체 중학교</SelectItem>
                  {allMiddleSchools.map((sch) => (
                    <SelectItem key={sch} value={sch} className="text-xs">
                      {sch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 학과 필터 */}
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                <SelectTrigger className="w-[130px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="학과 전체" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">전체 학과</SelectItem>
                  {allMajors.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 기업 구분 필터 */}
              <Select value={selectedCompanyType} onValueChange={setSelectedCompanyType}>
                <SelectTrigger className="w-[130px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="기업구분 전체" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">전체 기업구분</SelectItem>
                  <SelectItem value="우수기업" className="text-xs font-bold text-purple-700">🏆 대·공기업·공무원</SelectItem>
                  <SelectItem value="대기업" className="text-xs">대기업</SelectItem>
                  <SelectItem value="공기업" className="text-xs">공기업</SelectItem>
                  <SelectItem value="공무원" className="text-xs">공무원</SelectItem>
                  <SelectItem value="중견기업" className="text-xs">중견기업</SelectItem>
                  <SelectItem value="강소기업" className="text-xs">강소기업</SelectItem>
                  <SelectItem value="중소기업" className="text-xs">중소기업</SelectItem>
                </SelectContent>
              </Select>

              {/* 필터 초기화 버튼 */}
              {(selectedMiddleSchool !== 'all' || selectedMajor !== 'all' || selectedCompanyType !== 'all' || searchTerm) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMiddleSchool('all');
                    setSelectedMajor('all');
                    setSelectedCompanyType('all');
                    setSearchTerm('');
                  }}
                  className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  초기화
                </Button>
              )}
            </div>

            {/* 우측 키워드 검색창 */}
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="학생명, 출신교, 취업처..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 h-9 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>
          </div>

          {/* 4. 학생 목록 테이블 (조회 모드 vs 직접 입력/수정 모드) */}
          {activeTab === 'manage' && (
            <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl">
              <div className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-900">
                  직접 입력 모드: 테이블 내 출신중학교, 석차백분율, 입학점수를 바로 입력하고 저장할 수 있습니다.
                </span>
                {hasInlineChanges && (
                  <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                    {inlineModifiedCount}명 수정됨
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetInlineChanges}
                  disabled={!hasInlineChanges || isSavingInline}
                  className="h-8 text-xs font-bold border-slate-200 text-slate-600"
                >
                  변경 취소
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveInlineChanges}
                  disabled={!hasInlineChanges || isSavingInline}
                  className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  {isSavingInline ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      수정사항 일괄 저장
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="py-3 font-bold text-slate-700 w-12 text-center">No</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">졸업년도 / 학번</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">성명</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">학과 / 반</TableHead>
                  <TableHead className="py-3 font-bold text-teal-800 bg-teal-50/50">
                    {activeTab === 'manage' ? '출신 중학교 (직접 입력)' : '출신 중학교'}
                  </TableHead>
                  <TableHead className="py-3 font-bold text-slate-700 text-right">
                    {activeTab === 'manage' ? '석차백분율(%)' : '입학 석차백분율'}
                  </TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">전형 구분</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">취업 현황</TableHead>
                  <TableHead className="py-3 font-bold text-slate-900">취업처 (기업명)</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">기업 구분</TableHead>
                  <TableHead className="py-3 font-bold text-center text-slate-700 w-16">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isSearching ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-16 text-slate-500 bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
                        <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-xs">
                          <Search className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-800">출신 중학교를 선택하거나 검색해 주세요</p>
                        <p className="text-xs text-slate-500 text-center leading-relaxed">
                          상단 드롭다운이나 빠른 선택 버튼에서 중학교를 선택하시거나,<br />
                          우측 검색창에 중학교명을 입력하시면 해당 학생 목록이 출력됩니다.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-slate-400">
                      일치하는 중학교 학생 데이터가 없습니다. 검색 조건을 변경해 보세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student, idx) => {
                    const isEmployed = student.business_type === '취업' || student.employment_status === '취업';
                    const isTopCompany = ['대기업', '공기업', '공무원'].includes(student.company_type || '');
                    const inlineData = inlineEdits[student.id] || {};
                    const currentSchool = inlineData.middle_school !== undefined ? inlineData.middle_school : (student.middle_school || '');
                    const currentRank = inlineData.admission_rank_percentile !== undefined ? inlineData.admission_rank_percentile : (student.admission_rank_percentile !== undefined && student.admission_rank_percentile !== null ? String(student.admission_rank_percentile) : '');
                    const currentType = inlineData.admission_type !== undefined ? inlineData.admission_type : (student.admission_type || '일반전형');

                    return (
                      <TableRow key={student.id} className={cn("hover:bg-slate-50/70 transition-colors", inlineEdits[student.id] && "bg-amber-50/40")}>
                        <TableCell className="text-center font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-[11px]">
                          <div className="font-sans font-semibold text-slate-700">
                            {student.graduation_year ? `${student.graduation_year}년` : '-'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {student.student_number || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          {student.student_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {student.major} {student.class_info && `(${student.class_info}반)`}
                        </TableCell>

                        {/* 출신 중학교 */}
                        <TableCell className="font-bold text-teal-800 bg-teal-50/30">
                          {activeTab === 'manage' ? (
                            <input
                              type="text"
                              value={currentSchool}
                              placeholder="중학교명 입력"
                              list="middle-school-suggestions"
                              onChange={(e) => handleInlineChange(student.id, 'middle_school', e.target.value)}
                              className="w-full h-7 px-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-500 font-bold"
                            />
                          ) : (
                            student.middle_school ? (
                              <span className="inline-flex items-center gap-1">
                                <School className="h-3 w-3 text-teal-600" />
                                {student.middle_school}
                              </span>
                            ) : (
                              <span className="text-slate-300 italic">미입력</span>
                            )
                          )}
                        </TableCell>

                        {/* 입학 석차 백분율 */}
                        <TableCell className="text-right font-mono text-slate-700">
                          {activeTab === 'manage' ? (
                            <input
                              type="number"
                              step="0.01"
                              placeholder="%"
                              value={currentRank}
                              onChange={(e) => handleInlineChange(student.id, 'admission_rank_percentile', e.target.value)}
                              className="w-20 h-7 px-2 text-xs text-right bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-500 font-mono"
                            />
                          ) : (
                            student.admission_rank_percentile !== undefined && student.admission_rank_percentile !== null ? (
                              <span className="font-bold text-slate-800">
                                {student.admission_rank_percentile}%
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )
                          )}
                        </TableCell>

                        {/* 전형 구분 */}
                        <TableCell className="text-slate-500 text-[11px]">
                          {activeTab === 'manage' ? (
                            <select
                              value={currentType}
                              onChange={(e) => handleInlineChange(student.id, 'admission_type', e.target.value)}
                              className="h-7 px-1.5 text-[11px] bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-500"
                            >
                              <option value="일반전형">일반전형</option>
                              <option value="특별전형">특별전형</option>
                              <option value="특성화고특별전형">특성화고특별전형</option>
                              <option value="취업희망자전형">취업희망자전형</option>
                              <option value="정원외">정원외</option>
                              <option value="기타">기타</option>
                            </select>
                          ) : (
                            student.admission_type || '-'
                          )}
                        </TableCell>

                        <TableCell>
                          {isEmployed ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                              취업완료
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">
                              {student.business_type || student.employment_status || '미취업'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-extrabold text-slate-900">
                          {student.company || student.latest_training_company ? (
                            <div className="flex items-center gap-1.5">
                              {isTopCompany && <Trophy className="h-3.5 w-3.5 text-purple-600 shrink-0" />}
                              <span>{student.company || student.latest_training_company}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.company_type ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] font-bold',
                                isTopCompany
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : 'bg-slate-100 text-slate-700'
                              )}
                            >
                              {student.company_type}
                            </Badge>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStudent(student)}
                            className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                            title="입학 정보 상세 수정"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* 엑셀 일괄 등록 모달 */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
        targetGraduationYear={undefined}
        students={initialStudents}
      />

      {/* 학생 단일 입학 정보 수정 모달 */}
      <AdmissionEditModal
        isOpen={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        student={editingStudent}
        onSuccess={() => {
          router.refresh();
        }}
        existingMiddleSchools={allMiddleSchools}
      />
    </div>
  );
}
