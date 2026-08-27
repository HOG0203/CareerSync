'use client';

import * as React from 'react';
import {
  Scale,
  Sparkles,
  ShieldAlert,
  Users,
  Award,
  Search,
  Filter,
  Download,
  Plus,
  RotateCcw,
  LayoutList,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  X,
  FileText,
  Clock,
  Check,
  Building2,
  Calendar,
  Zap,
  CheckSquare,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { MeritDemeritRule } from '@/app/(dashboard)/admin/settings/actions';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { 
  StudentMeritDemeritSummary, 
  getCachedMeritDemeritSummaryList,
  refreshAllGradesMeritDemeritAction
} from './actions';
import { GrantModal } from './grant-modal';
import { BulkGrantModal } from './bulk-grant-modal';
import { HistoryModal } from './history-modal';
import { RulesConfigModal } from './rules-config-modal';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStudentClassTag } from '@/lib/utils';

interface MeritDemeritClientProps {
  initialGrade: number;
  initialGradeDataMap: Record<number, StudentMeritDemeritSummary[]>;
  availableGrades: number[];
  classStructure: Record<number, Record<string, string[]>>;
  baseYear: number;
  userProfile: any;
  meritRules: MeritDemeritRule[];
}

export function MeritDemeritClient({
  initialGrade,
  initialGradeDataMap,
  availableGrades,
  classStructure,
  baseYear,
  userProfile,
  meritRules,
}: MeritDemeritClientProps) {
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';

  // 1. [초고속 SWR 메모리 캐시] 전 학년(1,2,3학년) 데이터 100% 인메모리 탑재 (0ms 탭 전환)
  const [gradeDataMap, setGradeDataMap] = React.useState<Record<number, StudentMeritDemeritSummary[]>>(initialGradeDataMap);
  const [activeGrade, setActiveGrade] = React.useState<number>(initialGrade);
  const [isLoadingGrade, setIsLoadingGrade] = React.useState<boolean>(false);

  // 상벌점 기준 규칙 상태 (동적 변경 반영)
  const [activeMeritRules, setActiveMeritRules] = React.useState<MeritDemeritRule[]>(meritRules);
  const [rulesConfigModalOpen, setRulesConfigModalOpen] = React.useState(false);

  // 2. 필터 상태
  const [selectedMajor, setSelectedMajor] = React.useState<string>('ALL');
  const [selectedClass, setSelectedClass] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'merit' | 'demerit' | 'caution' | 'clean'>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [viewMode, setViewMode] = React.useState<'table' | 'cards'>('table');

  // 3. 다중 선택 체크박스
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<Set<string>>(new Set());

  // 4. 모달 상태
  const [grantModalOpen, setGrantModalOpen] = React.useState(false);
  const [grantTargetStudents, setGrantTargetStudents] = React.useState<StudentMeritDemeritSummary[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = React.useState(false);

  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [historyTargetStudent, setHistoryTargetStudent] = React.useState<StudentMeritDemeritSummary | null>(null);

  const [isExportingExcel, setIsExportingExcel] = React.useState(false);

  // 화면 크기에 따른 기본 뷰 모드 자동 감지
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setViewMode('cards');
    }
  }, []);

  // 현재 활성 학년 학생 목록
  const currentGradeStudents = gradeDataMap[activeGrade] || [];

  // 학년 탭 전환 핸들러 (0ms 즉각 전환)
  const handleGradeChange = async (grade: number) => {
    setActiveGrade(grade);
    setSelectedStudentIds(new Set());
    setSelectedMajor('ALL');
    setSelectedClass('ALL');

    if (!gradeDataMap[grade]) {
      setIsLoadingGrade(true);
      try {
        const students = await getCachedMeritDemeritSummaryList(grade, baseYear);
        setGradeDataMap(prev => ({ ...prev, [grade]: students }));
      } catch (err: any) {
        toast({ variant: 'destructive', title: '데이터 로딩 실패', description: err.message });
      } finally {
        setIsLoadingGrade(false);
      }
    }
  };

  // 전 학년 실시간 새로고침 (DB 직접 조회 및 최신 동기화)
  const handleRefresh = async () => {
    setIsLoadingGrade(true);
    try {
      const allData = await refreshAllGradesMeritDemeritAction(baseYear);
      setGradeDataMap(allData);
      toast({ title: '데이터 새로고침 완료', description: '전 학년 상벌점 데이터가 최신 상태로 갱신되었습니다.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '새로고침 실패', description: err.message });
    } finally {
      setIsLoadingGrade(false);
    }
  };

  // [초고속 낙관적 UI 업데이트 (0ms 즉시 렌더링)] 부여 즉시 화면 점수/이력 갱신
  const applyOptimisticGrant = (params: {
    studentIds: string[];
    type: 'merit' | 'demerit';
    points: number;
    ruleName: string;
    date: string;
    memo?: string;
  }) => {
    setGradeDataMap(prev => {
      const next = { ...prev };
      const sidSet = new Set(params.studentIds);
      
      [1, 2, 3].forEach(g => {
        if (!next[g]) return;
        next[g] = next[g].map(s => {
          if (!sidSet.has(s.id)) return s;
          const isMerit = params.type === 'merit';
          const newMerit = s.totalMeritPoints + (isMerit ? params.points : 0);
          const newDemerit = s.totalDemeritPoints + (!isMerit ? params.points : 0);
          const newNet = newMerit - newDemerit;
          const newRecordSummary = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: params.type,
            rule_name: params.ruleName,
            points: params.points,
            date: params.date,
            memo: params.memo || '',
            granted_by_name: userProfile?.full_name || userProfile?.username || '교사'
          };
          return {
            ...s,
            totalMeritPoints: newMerit,
            totalDemeritPoints: newDemerit,
            netPoints: newNet,
            recordsCount: s.recordsCount + 1,
            recentRecords: [newRecordSummary, ...s.recentRecords.slice(0, 2)]
          };
        });
      });
      return next;
    });
  };

  // 현재 선택된 학년의 학과 목록
  const availableMajors = React.useMemo(() => {
    const majorsObj = classStructure[activeGrade] || {};
    return Object.keys(majorsObj);
  }, [classStructure, activeGrade]);

  // 현재 선택된 학과의 반 목록
  const availableClasses = React.useMemo(() => {
    if (selectedMajor === 'ALL') return [];
    const majorsObj = classStructure[activeGrade] || {};
    return majorsObj[selectedMajor] || [];
  }, [classStructure, activeGrade, selectedMajor]);

  // 클라이언트 메모리 기반 60fps 초고속 필터링 및 숫자 정렬 (1 > 2 > 3 ... > 10 > 11)
  const filteredStudents = React.useMemo(() => {
    const list = currentGradeStudents.filter(s => {
      if (selectedMajor !== 'ALL' && s.major !== selectedMajor) return false;
      if (selectedClass !== 'ALL' && s.class_info !== selectedClass) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchName = s.student_name.toLowerCase().includes(query);
        const matchNum = s.student_number?.includes(query);
        const matchMajor = s.major?.toLowerCase().includes(query);
        const matchClass = s.class_info ? `${s.class_info}반`.includes(query) : false;
        if (!matchName && !matchNum && !matchMajor && !matchClass) return false;
      }

      if (statusFilter === 'merit') return s.totalMeritPoints > 0;
      if (statusFilter === 'demerit') return s.totalDemeritPoints > 0;
      if (statusFilter === 'caution') return s.totalDemeritPoints >= 5;
      if (statusFilter === 'clean') return s.totalDemeritPoints === 0;

      return true;
    });

    return list.sort((a, b) => {
      // 1. 학과 정렬
      const idxA = MAJOR_SORT_ORDER.indexOf(a.major);
      const idxB = MAJOR_SORT_ORDER.indexOf(b.major);
      const majorDiff = (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      if (majorDiff !== 0) return majorDiff;

      // 2. 반 정렬 (숫자 우선: 1반, 2반 ... 10반)
      const classA = parseInt(a.class_info) || 0;
      const classB = parseInt(b.class_info) || 0;
      if (classA !== classB) return classA - classB;
      const classComp = a.class_info.localeCompare(b.class_info, 'ko', { numeric: true });
      if (classComp !== 0) return classComp;

      // 3. 번호 정렬 (숫자 우선: 1번 > 2번 > 3번 ... > 10번 > 11번)
      const numA = parseInt(a.student_number) || 0;
      const numB = parseInt(b.student_number) || 0;
      if (numA !== numB) return numA - numB;
      const numComp = a.student_number.localeCompare(b.student_number, 'ko', { numeric: true });
      if (numComp !== 0) return numComp;

      // 4. 이름 정렬
      return a.student_name.localeCompare(b.student_name, 'ko');
    });
  }, [currentGradeStudents, selectedMajor, selectedClass, searchTerm, statusFilter]);

  // KPI 통계 집계
  const stats = React.useMemo(() => {
    const totalStudents = currentGradeStudents.length;
    let totalMeritPoints = 0;
    let totalDemeritPoints = 0;
    let meritStudentsCount = 0;
    let demeritStudentsCount = 0;
    let cautionStudentsCount = 0;

    currentGradeStudents.forEach(s => {
      totalMeritPoints += s.totalMeritPoints;
      totalDemeritPoints += s.totalDemeritPoints;
      if (s.totalMeritPoints > 0) meritStudentsCount++;
      if (s.totalDemeritPoints > 0) demeritStudentsCount++;
      if (s.totalDemeritPoints >= 5) cautionStudentsCount++;
    });

    return {
      totalStudents,
      totalMeritPoints,
      totalDemeritPoints,
      meritStudentsCount,
      demeritStudentsCount,
      cautionStudentsCount,
    };
  }, [currentGradeStudents]);

  // 전체 선택 / 해제 토글
  const handleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 단일 학생 상벌점 부여 모달 열기
  const handleOpenGrantModalSingle = (student: StudentMeritDemeritSummary) => {
    setGrantTargetStudents([student]);
    setGrantModalOpen(true);
  };

  // 상세 이력 모달 열기
  const handleOpenHistoryModal = (student: StudentMeritDemeritSummary) => {
    setHistoryTargetStudent(student);
    setHistoryModalOpen(true);
  };

  // 엑셀 다운로드 (지연 로딩)
  const handleExportExcel = async () => {
    if (filteredStudents.length === 0) return;
    setIsExportingExcel(true);
    try {
      const XLSX = await import('xlsx');
      const dataToExport = filteredStudents.map((s, idx) => ({
        '순번': idx + 1,
        '학년': `${s.grade}학년`,
        '학과': s.major,
        '반': s.class_info ? `${s.class_info}반` : '',
        '번호': s.student_number || '',
        '이름': s.student_name,
        '총 상점(+)': s.totalMeritPoints,
        '총 벌점(-)': s.totalDemeritPoints,
        '누계 점수(상계)': s.netPoints,
        '상벌점 부여 횟수': s.recordsCount,
        '최근 부여 내역': s.recentRecords.map(r => `[${r.type === 'merit' ? '상' : '벌'}+${r.points}] ${r.rule_name}(${r.date})`).join(' / ')
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${activeGrade}학년 상벌점대장`);
      
      const fileName = `${baseYear}학년도_${activeGrade}학년_학생상벌점대장_${selectedMajor !== 'ALL' ? selectedMajor : '전체'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast({ title: '엑셀 다운로드 완료', description: `${fileName} 파일이 저장되었습니다.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '엑셀 변환 오류', description: err.message });
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full">
      {/* 1. 상단 통계 KPI 카드 (모바일 2열 / 데스크톱 4열) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-2.5 sm:p-3 bg-white border-slate-200/80 shadow-2xs rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">학년 총 학생</span>
            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-slate-900">{stats.totalStudents}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">명</span>
          </div>
        </Card>

        <Card className="p-2.5 sm:p-3 bg-white border-emerald-100 shadow-2xs rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700">총 상점(+) 부여</span>
            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-emerald-600">+{stats.totalMeritPoints}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700">점 ({stats.meritStudentsCount}명)</span>
          </div>
        </Card>

        <Card className="p-2.5 sm:p-3 bg-white border-rose-100 shadow-2xs rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-700">총 벌점(-) 부여</span>
            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-rose-600">-{stats.totalDemeritPoints}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-700">점 ({stats.demeritStudentsCount}명)</span>
          </div>
        </Card>

        <Card className="p-2.5 sm:p-3 bg-white border-amber-100 shadow-2xs rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-800">5점이상 주의</span>
            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-amber-600">{stats.cautionStudentsCount}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-700">명 (집중지도)</span>
          </div>
        </Card>
      </div>

      {/* 2. 툴바 영역 (모바일 최적화 배치) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
        {/* 상단 1행: 학년 탭 (모바일 전체 너비 균등 분할) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl w-full sm:w-auto">
            {availableGrades.map(grade => (
              <button
                key={grade}
                type="button"
                onClick={() => handleGradeChange(grade)}
                className={cn(
                  "flex-1 sm:flex-initial h-9 sm:h-10 px-3 sm:px-5.5 text-xs sm:text-sm font-black rounded-lg transition-all text-center select-none",
                  activeGrade === grade ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {grade}학년
              </button>
            ))}
          </div>

          {/* 우측 조작 버튼 그룹 */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-between sm:justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => setBulkModalOpen(true)}
              className="flex-1 sm:flex-initial h-9 sm:h-10 px-3 sm:px-5 text-xs sm:text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 gap-1.5 transition-all active:scale-95 shrink-0"
            >
              <Zap className="h-4 w-4" />
              <span>
                {selectedStudentIds.size > 0 
                  ? `${selectedStudentIds.size}명 일괄 부여` 
                  : '상벌점 일괄 부여'}
              </span>
            </Button>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRulesConfigModalOpen(true)}
                className="h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-bold text-slate-700 border-slate-200 rounded-xl hover:bg-slate-50 gap-1.5 shadow-2xs"
                title="학생 상벌점 기준 항목 설정"
              >
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                <span className="hidden sm:inline">기준 설정</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isLoadingGrade}
                className="h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs font-bold text-slate-700 border-slate-200 rounded-xl hover:bg-slate-50 gap-1"
                title="데이터 새로고침"
              >
                <RotateCcw className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", isLoadingGrade && "animate-spin")} />
                <span className="hidden md:inline">새로고침</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
                disabled={isExportingExcel || filteredStudents.length === 0}
                className="h-9 sm:h-10 px-2.5 sm:px-4 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 rounded-xl gap-1 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">엑셀 다운로드</span>
              </Button>

              {/* 뷰 모드 토글 (모바일 / 데스크톱 지원) */}
              <div className="flex items-center h-9 sm:h-10 bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-lg text-slate-600 transition-all",
                    viewMode === 'table' ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                  )}
                  title="테이블 뷰"
                >
                  <TableIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-lg text-slate-600 transition-all",
                    viewMode === 'cards' ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"
                  )}
                  title="카드 뷰"
                >
                  <LayoutList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 중단: 학과/반 필터 (모바일 2열) + 검색창 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
          <div>
            <Select 
              value={selectedMajor} 
              onValueChange={(val) => {
                setSelectedMajor(val);
                setSelectedClass('ALL');
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl font-medium">
                <SelectValue placeholder="학과 전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 학과</SelectItem>
                {availableMajors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select 
              value={selectedClass} 
              onValueChange={setSelectedClass}
              disabled={selectedMajor === 'ALL'}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl font-medium">
                <SelectValue placeholder={selectedMajor === 'ALL' ? '학과 먼저 선택' : '반 전체'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 반</SelectItem>
                {availableClasses.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 sm:col-span-2 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="학생 성명, 학번, 학과 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-7 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl focus:bg-white font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 하단: 상태 필터 칩 (모바일 가로 스크롤) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-bold border transition-all text-xs shrink-0 flex items-center gap-1",
              statusFilter === 'all' 
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs" 
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            )}
          >
            <span>전체</span>
            <span className="text-[10px] opacity-80">({currentGradeStudents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('merit')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-bold border transition-all text-xs shrink-0 flex items-center gap-1",
              statusFilter === 'merit' 
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs" 
                : "bg-emerald-50/50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60"
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>상점보유</span>
            <span className="text-[10px] opacity-80">({stats.meritStudentsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('demerit')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-bold border transition-all text-xs shrink-0 flex items-center gap-1",
              statusFilter === 'demerit' 
                ? "bg-rose-600 text-white border-rose-600 shadow-2xs" 
                : "bg-rose-50/50 text-rose-700 border-rose-200 hover:bg-rose-100/60"
            )}
          >
            <ShieldAlert className="h-3 w-3" />
            <span>벌점보유</span>
            <span className="text-[10px] opacity-80">({stats.demeritStudentsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('caution')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-bold border transition-all text-xs shrink-0 flex items-center gap-1",
              statusFilter === 'caution' 
                ? "bg-amber-600 text-white border-amber-600 shadow-2xs" 
                : "bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100/60"
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>벌점 5점이상 주의</span>
            <span className="text-[10px] opacity-80">({stats.cautionStudentsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('clean')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-bold border transition-all text-xs shrink-0 flex items-center gap-1",
              statusFilter === 'clean' 
                ? "bg-blue-600 text-white border-blue-600 shadow-2xs" 
                : "bg-blue-50/50 text-blue-700 border-blue-200 hover:bg-blue-100/60"
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>벌점 0점(청정)</span>
          </button>
        </div>
      </div>

      {/* 3. 학생 목록 메인 콘텐츠 (테이블 뷰 vs 카드 뷰) */}
      <div className="space-y-2">
        {/* 모바일/데스크톱 선택 상태 바 */}
        <div className="flex items-center justify-between text-xs px-1 text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>조회 <strong className="text-slate-900">{filteredStudents.length}</strong>명</span>
            {selectedStudentIds.size > 0 && (
              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {selectedStudentIds.size}명 선택됨
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAllFiltered(selectedStudentIds.size !== filteredStudents.length)}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 ? '선택 해제' : '목록 전체 선택'}
            </button>
          </div>
        </div>

        {/* 3-A. 테이블 뷰 (모바일 가로 스크롤 지원) */}
        {viewMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3.5 w-10 text-center">
                      <Checkbox 
                        checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                        onCheckedChange={handleSelectAllFiltered}
                        className="rounded"
                      />
                    </th>
                    <th className="py-3 px-3 w-16 text-center">학년</th>
                    <th className="py-3 px-3 w-28">학과</th>
                    <th className="py-3 px-3 w-16 text-center">반</th>
                    <th className="py-3 px-3 w-16 text-center">번호</th>
                    <th className="py-3 px-3 w-24">이름</th>
                    <th className="py-3 px-3 w-24 text-center">상점(+)</th>
                    <th className="py-3 px-3 w-24 text-center">벌점(-)</th>
                    <th className="py-3 px-3 w-24 text-center">누계(상계)</th>
                    <th className="py-3 px-3">최근 부여 내역</th>
                    <th className="py-3 px-3 w-28 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 italic text-xs">
                        일치하는 학생 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const isSelected = selectedStudentIds.has(s.id);
                      return (
                        <tr 
                          key={s.id}
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors",
                            isSelected && "bg-indigo-50/40"
                          )}
                        >
                          <td className="py-2.5 px-3.5 text-center">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectStudent(s.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                            {s.grade}학년
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {s.major}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                            {s.class_info ? `${s.class_info}반` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                            {s.student_number ? `${s.student_number}번` : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">
                            {s.student_name}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn(
                              "font-black text-xs px-2 py-0.5 rounded-md",
                              s.totalMeritPoints > 0 ? "text-emerald-700 bg-emerald-50" : "text-slate-400"
                            )}>
                              +{s.totalMeritPoints}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn(
                              "font-black text-xs px-2 py-0.5 rounded-md",
                              s.totalDemeritPoints >= 5 
                                ? "text-rose-700 bg-rose-100 font-extrabold" 
                                : (s.totalDemeritPoints > 0 ? "text-rose-600 bg-rose-50" : "text-slate-400")
                            )}>
                              -{s.totalDemeritPoints}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn(
                              "font-black text-xs px-2 py-0.5 rounded-md",
                              s.netPoints > 0 ? "text-emerald-800 bg-emerald-100" : (s.netPoints < 0 ? "text-rose-800 bg-rose-100" : "text-slate-600 bg-slate-100")
                            )}>
                              {s.netPoints > 0 ? `+${s.netPoints}` : s.netPoints}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {s.recentRecords.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {s.recentRecords.map((r, i) => (
                                  <span 
                                    key={i} 
                                    className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                      r.type === 'merit' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                    )}
                                    title={`${r.date} (${r.granted_by_name}): ${r.memo || ''}`}
                                  >
                                    {r.type === 'merit' ? `+${r.points}` : `-${r.points}`} {r.rule_name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">기록 없음</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenGrantModalSingle(s)}
                                className="h-7 px-2 text-xs font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 rounded-lg gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                부여
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenHistoryModal(s)}
                                className="h-7 px-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg gap-1"
                              >
                                <FileText className="h-3 w-3" />
                                이력
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 3-B. 카드 뷰 (모바일 터치 최적화 레이아웃) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredStudents.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic text-xs bg-white rounded-2xl border border-slate-200">
                일치하는 학생 데이터가 없습니다.
              </div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = selectedStudentIds.has(s.id);
                return (
                  <Card 
                    key={s.id}
                    className={cn(
                      "p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between gap-3 transition-all",
                      isSelected && "border-indigo-300 bg-indigo-50/30 ring-1 ring-indigo-200"
                    )}
                  >
                    {/* 상단: 체크박스 + 학생 기본 정보 + 누계 점수 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectStudent(s.id)}
                          className="rounded h-4.5 w-4.5"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-slate-900 truncate">{s.student_name}</span>
                            <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-50 text-slate-600 border-slate-200 shrink-0">
                              {s.major} {s.class_info}반
                            </Badge>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400">
                            {s.student_number ? `${s.student_number}번` : '번호 미지정'}
                          </span>
                        </div>
                      </div>

                      {/* 누계 점수 뱃지 */}
                      <div className={cn(
                        "px-2.5 py-1 rounded-xl text-center shrink-0 border",
                        s.netPoints > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : (s.netPoints < 0 ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-slate-50 text-slate-700 border-slate-200")
                      )}>
                        <span className="text-[9px] font-bold block opacity-70">누계 점수</span>
                        <span className="text-sm font-black">
                          {s.netPoints > 0 ? `+${s.netPoints}점` : `${s.netPoints}점`}
                        </span>
                      </div>
                    </div>

                    {/* 중단: 상점 / 벌점 세부 현황 바 */}
                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> 상점:
                        </span>
                        <span className="font-black text-emerald-700">+{s.totalMeritPoints}점</span>
                      </div>
                      <div className="flex items-center justify-between border-l pl-2">
                        <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> 벌점:
                        </span>
                        <span className={cn("font-black", s.totalDemeritPoints >= 5 ? "text-rose-700 font-extrabold" : "text-rose-600")}>
                          -{s.totalDemeritPoints}점
                        </span>
                      </div>
                    </div>

                    {/* 최근 부여 내역 */}
                    {s.recentRecords.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block">최근 기록</span>
                        <div className="flex flex-wrap gap-1">
                          {s.recentRecords.slice(0, 2).map((r, i) => (
                            <span 
                              key={i} 
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                r.type === 'merit' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                              )}
                            >
                              {r.type === 'merit' ? `+${r.points}` : `-${r.points}`} {r.rule_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 하단 터치 액션 버튼 (모바일 2열 균등) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenGrantModalSingle(s)}
                        className="h-8.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs gap-1 shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        상벌점 부여
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenHistoryModal(s)}
                        className="h-8.5 text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        상세 이력
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 상벌점 일괄 부여 모달 (전교생 1·2·3학년 교차 선택 지원) */}
      <BulkGrantModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        allGradesDataMap={gradeDataMap}
        activeGrade={activeGrade}
        preSelectedStudentIds={Array.from(selectedStudentIds)}
        meritRules={activeMeritRules}
        classStructure={classStructure}
        academicYear={baseYear}
        onSuccess={(params) => {
          setSelectedStudentIds(new Set());
          applyOptimisticGrant(params);
        }}
      />

      {/* 상벌점 단일 부여 모달 */}
      <GrantModal
        isOpen={grantModalOpen}
        onClose={() => setGrantModalOpen(false)}
        selectedStudents={grantTargetStudents}
        meritRules={activeMeritRules}
        grade={activeGrade}
        academicYear={baseYear}
        onSuccess={applyOptimisticGrant}
      />

      {/* 상벌점 상세 이력 및 삭제 모달 */}
      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        student={historyTargetStudent}
        onRecordDeleted={handleRefresh}
      />

      {/* 학생 상벌점 기준 설정 모달 */}
      <RulesConfigModal
        isOpen={rulesConfigModalOpen}
        onClose={() => setRulesConfigModalOpen(false)}
        initialRules={activeMeritRules}
        onSaved={(newRules) => {
          setActiveMeritRules(newRules);
        }}
      />
    </div>
  );
}