'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FullStudentEvaluation, CertificationRank } from '@/lib/certification-calculator';
import { EvaluationSheetModal } from './evaluation-sheet-modal';
import { EvaluationEditModal } from './evaluation-edit-modal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import Link from 'next/link';
import {
  Award,
  Search,
  FileSpreadsheet,
  Edit3,
  FileText,
  Lock,
  GraduationCap,
  Users,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CertificationSummaryClientProps {

  initialEvaluations: FullStudentEvaluation[];
  currentGrade: number;
  baseYear: number;
  isAdmin: boolean;
  userProfile: any;
  masterCertificates?: any[];
}

const TARGET_MAJOR_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '건설과',
  '스마트공간건축과',
  '스마트공간과',
  '스마트전기과',
  '바이오화학과',
  '스마트융합섬유과',
  '스마트융함섬유과',
];

import { getCachedCertificationSummaryList } from './actions';

export function CertificationSummaryClient({
  initialEvaluations,
  currentGrade,
  baseYear,
  isAdmin,
  userProfile,
  masterCertificates = [],
}: CertificationSummaryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeGrade, setActiveGrade] = React.useState<number>(currentGrade);
  const [gradeDataMap, setGradeDataMap] = React.useState<Record<number, FullStudentEvaluation[]>>({
    [currentGrade]: initialEvaluations,
  });
  const [isLoadingGrade, setIsLoadingGrade] = React.useState<boolean>(false);

  const [selectedClass, setSelectedClass] = React.useState<string>('all');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [rankFilter, setRankFilter] = React.useState<string>('all');
  const [onlyCertified, setOnlyCertified] = React.useState<boolean>(false);
  const [search, setSearch] = React.useState<string>('');
  const [sortCriteria, setSortCriteria] = React.useState<'score_desc' | 'class_num' | 'score_asc' | 'name_asc'>('score_desc');

  // 모달 상태
  const [sheetModalEval, setSheetModalEval] = React.useState<FullStudentEvaluation | null>(null);
  const [editModalEval, setEditModalEval] = React.useState<FullStudentEvaluation | null>(null);

  const [pageSize, setPageSize] = React.useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  const currentEvaluations = gradeDataMap[activeGrade] || [];

  // 필터 또는 정렬 변경 시 페이지 1로 자동 리셋
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, selectedMajor, rankFilter, onlyCertified, search, sortCriteria, activeGrade, pageSize]);

  // 학년 변경 처리 (초고속 인메모리 캐싱 전환)
  const handleGradeChange = async (targetGradeNum: number) => {
    setActiveGrade(targetGradeNum);
    setSelectedClass('all');
    setSelectedMajor('all');
    setCurrentPage(1);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('grade', String(targetGradeNum));
      window.history.replaceState(null, '', url.toString());
    }

    if (!gradeDataMap[targetGradeNum]) {
      setIsLoadingGrade(true);
      try {
        const data = await getCachedCertificationSummaryList(targetGradeNum);
        setGradeDataMap(prev => ({ ...prev, [targetGradeNum]: data }));
      } catch (err) {
        console.error('Failed to load grade data:', err);
      } finally {
        setIsLoadingGrade(false);
      }
    }
  };

  // 1. 고유 학과 및 학반 목록 추출 (지정 학과 우선순위 및 자연수 정렬)
  const uniqueMajors = React.useMemo(() => {
    const s = new Set<string>();
    currentEvaluations.forEach(e => { if (e.major) s.add(e.major); });
    return Array.from(s).sort((a, b) => {
      const idxA = TARGET_MAJOR_ORDER.findIndex(m => a.includes(m) || m.includes(a));
      const idxB = TARGET_MAJOR_ORDER.findIndex(m => b.includes(m) || m.includes(b));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'ko');
    });
  }, [currentEvaluations]);

  const uniqueClasses = React.useMemo(() => {
    const s = new Set<string>();
    currentEvaluations.forEach(e => { if (e.classInfo) s.add(e.classInfo); });
    return Array.from(s).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [currentEvaluations]);

  // 2. 권한 체크 헬퍼 (관리자 또는 해당 학반 담임교사 여부)
  const canEditStudent = (student: FullStudentEvaluation) => {
    if (isAdmin) return true;
    if (userProfile?.role === 'teacher') {
      return (
        userProfile.assigned_grade === activeGrade &&
        userProfile.assigned_class === student.classInfo
      );
    }
    return false;
  };

  // 3. 통계 계산
  const stats = React.useMemo(() => {
    const total = currentEvaluations.length;
    if (total === 0) {
      return { avgScore: 0, certifiedCount: 0, certifiedRate: 0, rankCounts: { S: 0, A: 0, B: 0, C: 0, D: 0 } };
    }

    const totalSum = currentEvaluations.reduce((acc, e) => acc + e.totalScore, 0);
    const avgScore = Math.round((totalSum / total) * 10) / 10;
    const certifiedCount = currentEvaluations.filter(e => e.isCertified).length;
    const certifiedRate = Math.round((certifiedCount / total) * 1000) / 10;

    const rankCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    currentEvaluations.forEach(e => {
      rankCounts[e.rank] = (rankCounts[e.rank] || 0) + 1;
    });

    return { avgScore, certifiedCount, certifiedRate, rankCounts };
  }, [currentEvaluations]);

  // 4. 필터링 및 정렬 로직 (기본: 종합 점수 높은 순 -> 학반/번호 자연수 순)
  const filteredList = React.useMemo(() => {
    return currentEvaluations
      .filter(e => {
        if (selectedClass !== 'all' && e.classInfo !== selectedClass) return false;
        if (selectedMajor !== 'all' && e.major !== selectedMajor) return false;
        if (rankFilter !== 'all' && e.rank !== rankFilter) return false;
        if (onlyCertified && !e.isCertified) return false;

        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = e.studentName.toLowerCase().includes(q);
          const matchNum = e.studentNumber.includes(q);
          const matchMajor = e.major.toLowerCase().includes(q);
          if (!matchName && !matchNum && !matchMajor) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortCriteria === 'score_desc') {
          // 1차: 종합 점수 내림차순
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          // 2차 동점 시: 학반 자연수 오름차순
          const classComp = a.classInfo.localeCompare(b.classInfo, undefined, { numeric: true, sensitivity: 'base' });
          if (classComp !== 0) return classComp;
          // 3차: 번호 자연수 오름차순
          return a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortCriteria === 'class_num') {
          const classComp = a.classInfo.localeCompare(b.classInfo, undefined, { numeric: true, sensitivity: 'base' });
          if (classComp !== 0) return classComp;
          return a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortCriteria === 'score_asc') {
          if (a.totalScore !== b.totalScore) {
            return a.totalScore - b.totalScore;
          }
          const classComp = a.classInfo.localeCompare(b.classInfo, undefined, { numeric: true, sensitivity: 'base' });
          if (classComp !== 0) return classComp;
          return a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortCriteria === 'name_asc') {
          return a.studentName.localeCompare(b.studentName, 'ko');
        }

        return 0;
      });
  }, [currentEvaluations, selectedClass, selectedMajor, rankFilter, onlyCertified, search, sortCriteria]);

  const totalPages = pageSize === 'all' ? 1 : (Math.ceil(filteredList.length / pageSize) || 1);

  const paginatedList = React.useMemo(() => {
    if (pageSize === 'all') return filteredList;
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // 5. 엑셀 다운로드 (동적 라이브러리 로드로 초기 화면 초고속화)
  const handleExportExcel = async () => {
    if (filteredList.length === 0) return;

    const XLSX = await import('xlsx');

    const exportRows = filteredList.map(e => ({
      '학년': `${activeGrade}학년`,
      '학과': e.major,
      '학반': e.classInfo,
      '번호': e.studentNumber,
      '성명': e.studentName,
      '종합점수': e.totalScore,
      '인증등급': `${e.rank}랭크`,
      '인증서발급여부': e.isCertified ? '발급대상' : '미달',
      '직업공통능력(25점)': e.vocationalCommonScore,
      '전공능력(25점)': e.majorScore,
      '취업역량강화(25점)': e.employmentScore,
      '인성능력(25점)': e.characterScore,
      '출결점수(10점)': e.details.attendance.score,
      '자격증목록': e.certificatesList.join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${activeGrade}학년_옥저인재인증평가`);
    XLSX.writeFile(wb, `${baseYear}학년도_${activeGrade}학년_옥저인재인증제_평가결과.xlsx`);
  };


  const getRankBadge = (rank: CertificationRank) => {
    switch (rank) {
      case 'S': return <Badge className="bg-amber-500 hover:bg-amber-600 font-extrabold text-white">S랭크</Badge>;
      case 'A': return <Badge className="bg-blue-600 hover:bg-blue-700 font-extrabold text-white">A랭크</Badge>;
      case 'B': return <Badge className="bg-emerald-600 hover:bg-emerald-700 font-extrabold text-white">B랭크</Badge>;
      case 'C': return <Badge className="bg-slate-500 hover:bg-slate-600 font-extrabold text-white">C랭크</Badge>;
      default: return <Badge className="bg-rose-500 hover:bg-rose-600 font-extrabold text-white">D랭크</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 p-3 sm:p-6 w-full max-w-full">
      {/* 1. 상단 종합 현황 KPI 대시보드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">평균 인증 점수</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.avgScore}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 ml-1">/ 100점</span>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">인증 대상 (70점↑)</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-600">{stats.certifiedCount}</span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-600">명</span>
              <span className="text-[10px] sm:text-xs font-extrabold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded ml-0.5">
                {stats.certifiedRate}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">최상위 S·A 랭크</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-2xl font-black text-amber-600">{stats.rankCounts.S + stats.rankCounts.A}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 ml-1">
              명 (S:{stats.rankCounts.S} / A:{stats.rankCounts.A})
            </span>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">평가 대상 인원</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{currentEvaluations.length}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 ml-1">명 재학</span>
          </div>
        </Card>
      </div>

      {/* 2. 필터 툴바 & 엑셀 액션 */}
      <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl p-3.5 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4">
          
          {/* 상단 1열: 학년 선택 + 검색창 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* 학년 탭 선택 */}
            <div className="grid grid-cols-3 sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              {[3, 2, 1].map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={activeGrade === g ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleGradeChange(g)}
                  className={cn(
                    "h-8 sm:h-7 px-3 text-xs font-extrabold rounded-lg transition-all",
                    activeGrade === g ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {g}학년
                </Button>
              ))}
            </div>

            {/* 검색창 */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="학생명, 학번, 학과 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 sm:h-8 text-xs bg-slate-50/80 border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* 중단 2열: 학과/학반 선택 & 랭크 필터 */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
            {/* 학과 & 학반 선택 */}
            <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[135px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="전체 학과" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-semibold">전체 학과</SelectItem>
                  {uniqueMajors.map(m => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[115px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="전체 반" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-semibold">전체 학반</SelectItem>
                  {uniqueClasses.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 등급 선택 (모바일 가로 스크롤 가능) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar shrink-0">
              {['all', 'S', 'A', 'B', 'C', 'D'].map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={rankFilter === r ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRankFilter(r)}
                  className={cn(
                    "h-7 px-2.5 text-[11px] font-bold rounded-lg transition-all shrink-0",
                    rankFilter === r ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {r === 'all' ? '전체' : `${r}랭크`}
                </Button>
              ))}
            </div>

            {/* 인증 대상만 토글 */}
            <Button
              type="button"
              variant={onlyCertified ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOnlyCertified(!onlyCertified)}
              className={cn(
                "h-9 sm:h-8 text-xs font-bold rounded-xl border gap-1.5 transition-all w-full sm:w-auto justify-center",
                onlyCertified 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs" 
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>70점↑ 인증 대상만 ({stats.certifiedCount}명)</span>
            </Button>
          </div>

          {/* 하단 3열: 정렬 & 표시개수 & 엑셀 버튼 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:flex gap-2">
              {/* 정렬 기준 선택 */}
              <Select value={sortCriteria} onValueChange={(val: any) => setSortCriteria(val)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-[140px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_desc" className="text-xs font-semibold">🏆 점수 높은순 (기본)</SelectItem>
                  <SelectItem value="class_num" className="text-xs">🔢 학반/번호순</SelectItem>
                  <SelectItem value="score_asc" className="text-xs">📉 점수 낮은순</SelectItem>
                  <SelectItem value="name_asc" className="text-xs">🔤 이름 가나다순</SelectItem>
                </SelectContent>
              </Select>

              {/* 표시 개수 선택 */}
              <Select value={String(pageSize)} onValueChange={(val) => setPageSize(val === 'all' ? 'all' : Number(val))}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-[120px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="표시 개수" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold">전체 보기 (전원)</SelectItem>
                  <SelectItem value="50" className="text-xs">50명씩 보기</SelectItem>
                  <SelectItem value="100" className="text-xs">100명씩 보기</SelectItem>
                  <SelectItem value="200" className="text-xs">200명씩 보기</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 엑셀 일괄 등록 & 다운로드 */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <Link href="/admin/certification/import" className="w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-8 px-3 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200 rounded-xl gap-1.5 shadow-2xs justify-center"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
                  <span>엑셀 일괄 등록</span>
                </Button>
              </Link>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="w-full sm:w-auto h-8 px-3 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white border-slate-200 rounded-xl gap-1.5 justify-center"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>엑셀 다운로드</span>
              </Button>
            </div>
          </div>

        </div>
      </Card>

      {/* 3. 학생 종합 평가 목록 (데스크톱: 테이블 / 모바일: 카드 리스트) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500">
            총 <span className="text-indigo-600 font-extrabold">{filteredList.length}</span>명 중{' '}
            <span className="text-slate-800 font-extrabold">
              {filteredList.length === 0 ? 0 : pageSize === 'all' ? `전체 ${filteredList.length}` : `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredList.length)}`}
            </span>
            명 {pageSize !== 'all' && `(${currentPage} / ${totalPages}p)`}
          </span>
        </div>

        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden flex flex-col">
          
          {/* ========================================================================= */}
          {/* [모바일 전용] 학생 카드 뷰 (화면폭 < 768px) */}
          {/* ========================================================================= */}
          <div className="block md:hidden divide-y divide-slate-100">
            {paginatedList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                조회된 학생 평가 데이터가 없습니다.
              </div>
            ) : (
              paginatedList.map((student) => {
                const hasEditAuth = canEditStudent(student);

                return (
                  <div key={student.studentId} className="p-3.5 sm:p-4 flex flex-col gap-3 hover:bg-slate-50/60 transition-colors">
                    {/* 상단: 학생 정보 + 랭크 배지 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                            {student.studentName}
                          </span>
                          <span className="text-xs text-slate-400 font-medium shrink-0">
                            ({student.studentNumber}번)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                          {student.major} • <strong className="text-slate-700">{student.classInfo}</strong>
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {getRankBadge(student.rank)}
                        {student.isCertified ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                            인증 대상
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full">
                            미달
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 점수 진행바 */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-bold text-slate-600">종합 인증 점수</span>
                        <span className="font-black text-indigo-700 text-sm">
                          {student.totalScore}
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">/ 100점</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${Math.min(100, student.totalScore)}%` }}
                        />
                      </div>
                    </div>

                    {/* 4대 영역별 점수 4열 그리드 */}
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">직업공통(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.vocationalCommonScore}점</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">전공능력(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.majorScore}점</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">취업역량(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.employmentScore}점</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">인성능력(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.characterScore}점</span>
                      </div>
                    </div>

                    {/* 모바일 액션 버튼 바 */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSheetModalEval(student)}
                        className="h-8 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 rounded-xl gap-1.5 justify-center"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>평가표 보기</span>
                      </Button>

                      {hasEditAuth ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditModalEval(student)}
                          className="h-8 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border-slate-200 rounded-xl gap-1.5 justify-center"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                          <span>실적 수정</span>
                        </Button>
                      ) : (
                        <div className="h-8 flex items-center justify-center gap-1 text-[11px] text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60 select-none">
                          <Lock className="h-3 w-3" />
                          <span>조회 전용</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ========================================================================= */}
          {/* [태블릿/데스크톱 전용] 종합 평가 테이블 (화면폭 >= 768px) */}
          {/* ========================================================================= */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="text-xs table-fixed w-full min-w-[960px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-extrabold text-slate-700 w-[190px]">학생 정보</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[110px]">종합 점수</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[100px]">인증 등급</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[120px]">인증서 발급</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[290px]">4대 영역별 점수</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[150px]">평가 및 관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      조회된 학생 평가 데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedList.map((student) => {
                    const hasEditAuth = canEditStudent(student);

                    return (
                      <TableRow key={student.studentId} className="hover:bg-slate-50/60 transition-colors">
                        {/* 학생 정보 */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{student.studentName}</span>
                              <span className="text-[11px] text-slate-400 font-medium">({student.studentNumber}번)</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                              <span>{student.major}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-slate-700">{student.classInfo}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 종합 점수 */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-base font-black text-indigo-700">
                              {student.totalScore}
                              <span className="text-xs font-normal text-slate-400 ml-0.5">점</span>
                            </span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 rounded-full transition-all"
                                style={{ width: `${Math.min(100, student.totalScore)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* 인증 등급 */}
                        <TableCell className="text-center">
                          {getRankBadge(student.rank)}
                        </TableCell>

                        {/* 인증서 발급 */}
                        <TableCell className="text-center">
                          {student.isCertified ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[11px] gap-1 px-2 py-0.5">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>발급 대상</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-semibold text-[11px] px-2 py-0.5">
                              미달 (70점 미만)
                            </Badge>
                          )}
                        </TableCell>

                        {/* 4대 영역별 점수 */}
                        <TableCell>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[11px]">
                            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">직업공통(25)</span>
                              <span className="font-bold text-slate-800">{student.vocationalCommonScore}점</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">전공능력(25)</span>
                              <span className="font-bold text-slate-800">{student.majorScore}점</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">취업역량(25)</span>
                              <span className="font-bold text-slate-800">{student.employmentScore}점</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">인성능력(25)</span>
                              <span className="font-bold text-slate-800">{student.characterScore}점</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 액션 버튼 */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 1. 공식 평가표 보기 모달 */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSheetModalEval(student)}
                              className="h-7 px-2.5 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 rounded-lg gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>평가표</span>
                            </Button>

                            {/* 2. 수동 보정/수정 모달 (권한 체크) */}
                            {hasEditAuth ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditModalEval(student)}
                                className="h-7 px-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border-slate-200 rounded-lg gap-1"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                <span>수정</span>
                              </Button>
                            ) : (
                              <div className="text-[11px] text-slate-300 flex items-center gap-0.5 px-2 py-1 select-none" title="해당 학급 담임교사 또는 관리자만 수정 가능합니다.">
                                <Lock className="h-3 w-3" />
                                <span>조회전용</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 페이지네이션 바 */}
          {totalPages > 1 && (
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between sm:justify-center gap-1 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                className="h-8 px-2.5 text-xs font-bold"
              >
                이전
              </Button>
              <div className="flex items-center gap-1 mx-1 sm:mx-3">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <Button 
                      key={pageNum} 
                      variant={currentPage === pageNum ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setCurrentPage(pageNum)} 
                      className={cn(
                        "h-8 w-8 p-0 font-bold text-xs", 
                        currentPage === pageNum ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                className="h-8 px-2.5 text-xs font-bold"
              >
                다음
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* 공식 평가표 조회 모달 */}
      <EvaluationSheetModal
        evaluation={sheetModalEval}
        open={!!sheetModalEval}
        onOpenChange={(open) => !open && setSheetModalEval(null)}
        canEdit={sheetModalEval ? canEditStudent(sheetModalEval) : false}
        currentUserProfile={userProfile}
        isAdmin={isAdmin}
        onDataMutated={async () => {
          const data = await getCachedCertificationSummaryList(activeGrade);
          setGradeDataMap(prev => ({ ...prev, [activeGrade]: data }));
          // 현재 열려있는 modal evaluation도 새 데이터로 갱신
          if (sheetModalEval) {
            const updated = data.find(d => d.studentId === sheetModalEval.studentId);
            if (updated) setSheetModalEval(updated);
            else setSheetModalEval(null);
          }
          router.refresh();
        }}
        onEditClick={() => {
          if (sheetModalEval) {
            setEditModalEval(sheetModalEval);
            setSheetModalEval(null);
          }
        }}
      />

      {/* 수동 보정/수정 폼 모달 */}
      <EvaluationEditModal
        evaluation={editModalEval}
        baseYear={baseYear}
        open={!!editModalEval}
        onOpenChange={(open) => !open && setEditModalEval(null)}
        masterCertificates={masterCertificates}
        onSaveSuccess={async () => {
          const data = await getCachedCertificationSummaryList(activeGrade);
          setGradeDataMap(prev => ({ ...prev, [activeGrade]: data }));
          router.refresh();
        }}
      />
    </div>
  );
}
