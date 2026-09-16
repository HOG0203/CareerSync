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
  Share2,
  Lock,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentEmploymentData } from '@/lib/data';
import { ExcelImportModal } from './excel-import-modal';
import { AdmissionEditModal } from './admission-edit-modal';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface MiddleSchoolEmploymentClientProps {
  initialStudents: StudentEmploymentData[];
  baseYear: number;
  userProfile?: any;
  isReadOnly?: boolean;
}

export function MiddleSchoolEmploymentClient({
  initialStudents,
  baseYear,
  userProfile,
  isReadOnly = false,
}: MiddleSchoolEmploymentClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}/share/admission/middle-school-employment`;
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    toast({
      title: '공유 링크 복사 완료',
      description: '외부 공개용 읽기 전용 링크가 클립보드에 복사되었습니다.',
    });
    setTimeout(() => setIsCopied(false), 2500);
  };

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedMiddleSchool, setSelectedMiddleSchool] = React.useState<string>('all');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [selectedCompanyType, setSelectedCompanyType] = React.useState<string>('all');

  // 모달 상태
  const [isExcelModalOpen, setIsExcelModalOpen] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<StudentEmploymentData | null>(null);

  // 출신 중학교 정보가 있거나 취업된 학생 목록 필터링
  const initialEmployedStudents = React.useMemo(() => {
    return initialStudents.filter((student) => {
      const hasMiddleSchool = Boolean(student.middle_school && student.middle_school.trim());
      const bType = (student.business_type || '').trim();
      const status = (student.employment_status || '').trim();
      const company = (student.company || student.latest_training_company || '').trim();
      const isEmployed = bType === '취업' || status === '취업' || (company !== '' && company !== '-' && company !== '미정');
      return hasMiddleSchool || isEmployed;
    });
  }, [initialStudents]);

  // 등록된 모든 중학교 목록 추출 (중복 제거 및 가나다 정렬)
  const allMiddleSchools = React.useMemo(() => {
    const set = new Set<string>();
    initialEmployedStudents.forEach((s) => {
      if (s.middle_school && s.middle_school.trim()) {
        set.add(s.middle_school.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [initialEmployedStudents]);

  // 학과 목록 추출
  const allMajors = React.useMemo(() => {
    const set = new Set<string>();
    initialEmployedStudents.forEach((s) => {
      if (s.major && s.major.trim()) set.add(s.major.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [initialEmployedStudents]);

  const isSearching = Boolean(
    (selectedMiddleSchool && selectedMiddleSchool !== 'all') || searchTerm.trim()
  );

  // 필터링된 학생 데이터
  const filteredStudents = React.useMemo(() => {
    return initialEmployedStudents.filter((student) => {
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
          if (!['대기업', '공기업', '공무원', '중견기업'].includes(cType)) return false;
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
  }, [initialEmployedStudents, selectedMiddleSchool, selectedMajor, selectedCompanyType, searchTerm, isSearching]);

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

    // 🏆 우수 기업(대기업·공기업·공무원·중견기업) 취업자 수 및 비율
    const excellentStudents = filteredStudents.filter((s) => {
      const cType = (s.company_type || '').trim();
      return ['대기업', '공기업', '공무원', '중견기업'].includes(cType);
    });
    const excellentCount = excellentStudents.length;
    const excellentRate = totalStudents > 0 ? Math.round((excellentCount / totalStudents) * 100) : 0;

    // 🥇 대·공기업·공무원 취업자 수 및 비율
    const topTierStudents = filteredStudents.filter((s) => {
      const cType = (s.company_type || '').trim();
      return ['대기업', '공기업', '공무원'].includes(cType);
    });
    const topTierCount = topTierStudents.length;
    const topTierRate = totalStudents > 0 ? Math.round((topTierCount / totalStudents) * 100) : 0;

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
      topCorporateCount: excellentCount,
      topCorporateRate: excellentRate,
      excellentCount,
      excellentRate,
      topTierCount,
      topTierRate,
      avgRankPercentile,
    };
  }, [filteredStudents]);

  // 엑셀 다운로드 핸들러
  const handleExportExcel = () => {
    const exportTarget = isSearching ? filteredStudents : initialEmployedStudents;
    if (!exportTarget || exportTarget.length === 0) {
      alert('내보낼 학생 데이터가 없습니다.');
      return;
    }

    const exportData = exportTarget.map((s, idx) => ({
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
    <div className="flex flex-col h-auto min-h-full max-h-none overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden gap-2.5 pb-12 lg:pb-0">
      {/* 1. 상단 타이틀 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-100 shrink-0">
              <School className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            </div>
            중학교별 취업현황
            <span className="text-[11px] bg-teal-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              {isReadOnly ? '외부공유 (읽기전용)' : '입학지원'}
            </span>
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            출신 중학교별 취업처 현황과 입학 전형 성적을 매칭하여 입학 설명회 및 진로 상담 자료로 활용합니다.
          </p>
        </div>

        {isReadOnly ? (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200/80 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 self-start sm:self-auto shadow-2xs">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>외부 공유 읽기 전용 모드 (수정 및 엑셀 다운로드 제한)</span>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyShareLink}
            className="h-9 px-3.5 text-xs font-bold rounded-xl border-teal-200 text-teal-700 bg-teal-50/50 hover:bg-teal-100/70 shrink-0 self-start sm:self-auto shadow-2xs"
          >
            {isCopied ? <Check className="h-4 w-4 mr-1.5 text-teal-600" /> : <Share2 className="h-4 w-4 mr-1.5 text-teal-600" />}
            {isCopied ? '공유 링크 복사 완료!' : '외부 공유 링크 복사'}
          </Button>
        )}
      </div>

      {/* 2. 요약 통계 카드 4종 (class-management 스타일) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                {selectedMiddleSchool !== 'all' ? `${selectedMiddleSchool} 출신 취업자` : '조회 취업자수'}
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.totalStudents}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                우수기업 취업률 <span className="text-[11px] sm:text-xs font-normal text-slate-400">(대·공·중견·공무원)</span>
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">
                {stats.excellentRate}% <span className="text-xs font-bold text-slate-500">({stats.excellentCount}명)</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                우수기업 취업 <span className="text-[11px] sm:text-xs font-normal text-slate-400">(대·공·중견·공무원)</span>
              </p>
              <p className="text-xl sm:text-2xl font-black text-purple-700 mt-0.5">
                {stats.excellentCount}명 <span className="text-xs font-bold text-slate-500">({stats.excellentRate}%)</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Trophy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">평균 입학 성적 (석차)</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {stats.avgRankPercentile !== null ? `상위 ${stats.avgRankPercentile}%` : '-'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 모던 통합 필터 & 검색 & 툴바 (class-management 스타일) */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0">
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between flex-wrap">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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

              {/* 기업 구분 필터 */}
              <Select value={selectedCompanyType} onValueChange={setSelectedCompanyType}>
                <SelectTrigger className="w-[155px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="기업구분 전체" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">전체 기업구분</SelectItem>
                  <SelectItem value="우수기업" className="text-xs font-bold text-purple-700">🏆 우수기업 (대·공·중견·공무원)</SelectItem>
                  <SelectItem value="대기업" className="text-xs">대기업</SelectItem>
                  <SelectItem value="공기업" className="text-xs">공기업</SelectItem>
                  <SelectItem value="공무원" className="text-xs">공무원</SelectItem>
                  <SelectItem value="중견기업" className="text-xs">중견기업</SelectItem>
                  <SelectItem value="강소기업" className="text-xs">강소기업</SelectItem>
                  <SelectItem value="중소기업" className="text-xs">중소기업</SelectItem>
                </SelectContent>
              </Select>

              {/* 필터 초기화 버튼 */}
              {(selectedMiddleSchool !== 'all' || selectedCompanyType !== 'all' || searchTerm) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMiddleSchool('all');
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

            {/* 우측 키워드 검색창 및 액션 버튼 툴바 */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="학생명, 출신교, 취업처..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl border-slate-200 bg-white"
                />
              </div>

              {!isReadOnly && (
                <div className="flex items-center gap-1.5 shrink-0">
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
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 핵심 데이터 테이블 영역 */}
      <Card className="h-auto overflow-visible lg:flex-1 lg:min-h-0 lg:overflow-hidden shadow-sm border border-slate-200/80 bg-white flex flex-col rounded-2xl min-w-full mb-0">
        <CardContent className="h-auto overflow-visible lg:flex-1 lg:overflow-hidden p-0 relative flex flex-col lg:min-h-0">
          <div className="w-full h-auto lg:h-full flex flex-col lg:min-h-0 overflow-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-2xs">
                <TableRow>
                  <TableHead className="py-3 font-bold text-slate-700 w-12 text-center">No</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">졸업년도 / 학번</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">성명</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">학과 / 반</TableHead>
                  <TableHead className="py-3 font-bold text-teal-800 bg-teal-50/50">출신 중학교</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700 text-right">입학 석차백분율</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">전형 구분</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">취업 현황</TableHead>
                  <TableHead className="py-3 font-bold text-slate-900">취업처 (기업명)</TableHead>
                  <TableHead className="py-3 font-bold text-slate-700">기업 구분</TableHead>
                  {!isReadOnly && <TableHead className="py-3 font-bold text-center text-slate-700 w-16">관리</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isReadOnly ? 10 : 11} className="text-center py-16 text-slate-400">
                      일치하는 중학교 학생 데이터가 없습니다. 검색 조건이나 학년도를 변경해 보세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student, idx) => {
                    const isEmployed = student.business_type === '취업' || student.employment_status === '취업';
                    const isTopCompany = ['대기업', '공기업', '공무원', '중견기업'].includes(student.company_type || '');

                    return (
                      <TableRow key={student.id} className="hover:bg-slate-50/70 transition-colors">
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
                          {student.middle_school ? (
                            <span className="inline-flex items-center gap-1">
                              <School className="h-3 w-3 text-teal-600" />
                              {student.middle_school}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">미입력</span>
                          )}
                        </TableCell>

                        {/* 입학 석차 백분율 */}
                        <TableCell className="text-right font-mono text-slate-700">
                          {student.admission_rank_percentile !== undefined && student.admission_rank_percentile !== null ? (
                            <span className="font-bold text-slate-800">
                              {student.admission_rank_percentile}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>

                        {/* 전형 구분 */}
                        <TableCell className="text-slate-500 text-[11px]">
                          {student.admission_type || '-'}
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
                        {!isReadOnly && (
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
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 엑셀 일괄 등록 모달 */}
      {!isReadOnly && (
        <ExcelImportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onSuccess={() => {
            router.refresh();
          }}
          targetGraduationYear={undefined}
          students={initialStudents}
        />
      )}

      {/* 학생 단일 입학 정보 수정 모달 */}
      {!isReadOnly && (
        <AdmissionEditModal
          isOpen={Boolean(editingStudent)}
          onClose={() => setEditingStudent(null)}
          student={editingStudent}
          onSuccess={() => {
            router.refresh();
          }}
          existingMiddleSchools={allMiddleSchools}
        />
      )}
    </div>
  );
}
