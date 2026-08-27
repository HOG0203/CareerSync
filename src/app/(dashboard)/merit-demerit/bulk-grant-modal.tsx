'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Sparkles, 
  ShieldAlert, 
  Users, 
  Calendar, 
  Award, 
  Loader2, 
  Search, 
  CheckSquare, 
  Square,
  Zap,
  ClipboardPaste,
  Filter,
  X,
  Trash2,
  Check,
  GraduationCap,
  Globe
} from 'lucide-react';
import { MeritDemeritRule } from '@/app/(dashboard)/admin/settings/actions';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { StudentMeritDemeritSummary, grantMeritDemeritAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStudentClassTag } from '@/lib/utils';
import { format } from 'date-fns';

interface BulkGrantModalProps {
  isOpen: boolean;
  onClose: () => void;
  allGradesDataMap: Record<number, StudentMeritDemeritSummary[]>;
  activeGrade: number | 'ALL';
  preSelectedStudentIds?: string[];
  meritRules: MeritDemeritRule[];
  classStructure: Record<number, Record<string, string[]>>;
  academicYear: number;
  onSuccess: (params: {
    studentIds: string[];
    type: 'merit' | 'demerit';
    points: number;
    ruleName: string;
    date: string;
    memo?: string;
  }) => void;
}

export function BulkGrantModal({
  isOpen,
  onClose,
  allGradesDataMap,
  activeGrade,
  preSelectedStudentIds = [],
  meritRules,
  classStructure,
  academicYear,
  onSuccess,
}: BulkGrantModalProps) {
  const [activeMode, setActiveMode] = React.useState<'select' | 'paste'>('select');
  const [targetGradeTab, setTargetGradeTab] = React.useState<number | 'ALL'>(activeGrade);

  // 전교생 선택 장바구니 (Set of Student IDs)
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<Set<string>>(new Set());
  
  // 필터 상태
  const [targetMajor, setTargetMajor] = React.useState<string>('ALL');
  const [targetClass, setTargetClass] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  // 엑셀 붙여넣기 텍스트
  const [pasteText, setPasteText] = React.useState<string>('');

  // 상벌점 설정
  const [type, setType] = React.useState<'merit' | 'demerit'>('merit');
  const [selectedRuleId, setSelectedRuleId] = React.useState<string>('');
  const [points, setPoints] = React.useState<number>(3);
  const [date, setDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [memo, setMemo] = React.useState<string>('');
  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  // 전교생 평탄화 목록 (1, 2, 3학년 통합)
  const allSchoolStudents = React.useMemo(() => {
    const list: StudentMeritDemeritSummary[] = [];
    [1, 2, 3].forEach(g => {
      if (allGradesDataMap[g]) {
        list.push(...allGradesDataMap[g]);
      }
    });
    return list;
  }, [allGradesDataMap]);

  // 모달 열릴 때 초기화
  React.useEffect(() => {
    if (isOpen) {
      if (preSelectedStudentIds.length > 0) {
        setSelectedStudentIds(new Set(preSelectedStudentIds));
      } else {
        setSelectedStudentIds(new Set());
      }
      setTargetGradeTab(activeGrade);
      setTargetMajor('ALL');
      setTargetClass('ALL');
      setSearchQuery('');
      setPasteText('');
      setMemo('');
    }
  }, [isOpen, preSelectedStudentIds, activeGrade]);

  const availableRules = React.useMemo(() => {
    return meritRules.filter(r => r.type === type && r.isActive !== false);
  }, [meritRules, type]);

  // 상벌점 타입 변경 시 기본 규칙 자동 선택
  React.useEffect(() => {
    if (availableRules.length > 0) {
      setSelectedRuleId(availableRules[0].id);
      setPoints(availableRules[0].points);
    } else {
      setSelectedRuleId('');
      setPoints(type === 'merit' ? 3 : 1);
    }
  }, [type, availableRules]);

  const handleRuleChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const found = availableRules.find(r => r.id === ruleId);
    if (found) {
      setPoints(found.points);
    }
  };

  // 퀵 프리셋 칩 클릭 핸들러
  const handleApplyQuickChip = (rule: MeritDemeritRule) => {
    setType(rule.type);
    setSelectedRuleId(rule.id);
    setPoints(rule.points);
  };

  // 현재 탭의 학과 목록
  const currentMajors = React.useMemo(() => {
    if (targetGradeTab === 'ALL') {
      const allM = new Set<string>();
      [1, 2, 3].forEach(g => {
        const majorsObj = classStructure[g] || {};
        Object.keys(majorsObj).forEach(m => allM.add(m));
      });
      return Array.from(allM).sort((a, b) => {
        const idxA = MAJOR_SORT_ORDER.indexOf(a);
        const idxB = MAJOR_SORT_ORDER.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
    }
    const majorsObj = classStructure[targetGradeTab] || {};
    return Object.keys(majorsObj);
  }, [classStructure, targetGradeTab]);

  // 현재 탭의 반 목록
  const currentClasses = React.useMemo(() => {
    if (targetMajor === 'ALL') return [];
    if (targetGradeTab === 'ALL') {
      const allClasses = new Set<string>();
      [1, 2, 3].forEach(g => {
        const majorsObj = classStructure[g] || {};
        (majorsObj[targetMajor] || []).forEach(c => allClasses.add(c));
      });
      return Array.from(allClasses).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
    }
    const majorsObj = classStructure[targetGradeTab] || {};
    return majorsObj[targetMajor] || [];
  }, [classStructure, targetGradeTab, targetMajor]);

  // 필터링된 학생 명단 (숫자 정렬: 1 > 2 > 3 ... > 10 > 11)
  const filteredStudents = React.useMemo(() => {
    const pool = targetGradeTab === 'ALL' ? allSchoolStudents : (allGradesDataMap[targetGradeTab] || []);

    const list = pool.filter(s => {
      if (targetMajor !== 'ALL' && s.major !== targetMajor) return false;
      if (targetClass !== 'ALL' && s.class_info !== targetClass) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = s.student_name.toLowerCase().includes(q);
        const matchNum = s.student_number?.includes(q);
        const matchMajor = s.major?.toLowerCase().includes(q);
        const matchClass = s.class_info ? `${s.class_info}반`.includes(q) : false;
        if (!matchName && !matchNum && !matchMajor && !matchClass) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      // 1. 학년
      if (sGrade(a) !== sGrade(b)) return sGrade(a) - sGrade(b);

      // 2. 학과
      const idxA = MAJOR_SORT_ORDER.indexOf(a.major);
      const idxB = MAJOR_SORT_ORDER.indexOf(b.major);
      const majorDiff = (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      if (majorDiff !== 0) return majorDiff;

      // 3. 반 (숫자 우선: 1반, 2반 ... 10반)
      const classA = parseInt(a.class_info) || 0;
      const classB = parseInt(b.class_info) || 0;
      if (classA !== classB) return classA - classB;
      const classComp = a.class_info.localeCompare(b.class_info, 'ko', { numeric: true });
      if (classComp !== 0) return classComp;

      // 4. 번호 (숫자 우선: 1번 > 2번 > 3번 ... > 10번 > 11번)
      const numA = parseInt(a.student_number) || 0;
      const numB = parseInt(b.student_number) || 0;
      if (numA !== numB) return numA - numB;
      const numComp = a.student_number.localeCompare(b.student_number, 'ko', { numeric: true });
      if (numComp !== 0) return numComp;

      // 5. 이름
      return a.student_name.localeCompare(b.student_name, 'ko');
    });
  }, [allSchoolStudents, allGradesDataMap, targetGradeTab, targetMajor, targetClass, searchQuery]);

  function sGrade(student: StudentMeritDemeritSummary): number {
    return student.grade || 3;
  }

  // 엑셀 붙여넣기 매칭 (전교생 1~3학년 자동 동시 탐색)
  const pastedMatchedStudents = React.useMemo(() => {
    if (!pasteText.trim()) return [];
    const lines = pasteText.split(/[\r\n,;\t]+/).map(l => l.trim()).filter(Boolean);
    const matched = new Set<string>();

    lines.forEach(line => {
      // 1. 학번 또는 이름으로 전교생 대상 매칭
      const found = allSchoolStudents.find(s => 
        s.student_name === line || 
        s.student_number === line || 
        line.includes(s.student_name) ||
        (s.student_number && line.includes(s.student_number))
      );
      if (found) matched.add(found.id);
    });

    return allSchoolStudents.filter(s => matched.has(s.id));
  }, [pasteText, allSchoolStudents]);

  // 엑셀 붙여넣기 매칭 학생들을 장바구니에 누적 추가
  const handleApplyPasted = () => {
    if (pastedMatchedStudents.length === 0) {
      toast({ variant: 'destructive', title: '일치하는 학생을 찾지 못했습니다.', description: '학생 이름이나 학번을 정확히 입력해주세요.' });
      return;
    }
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      pastedMatchedStudents.forEach(s => next.add(s.id));
      return next;
    });
    setActiveMode('select');
    toast({ 
      title: '장바구니 담기 완료', 
      description: `전교생 중 매칭된 ${pastedMatchedStudents.length}명이 선택 목록에 추가되었습니다.` 
    });
  };

  // 현재 필터된 목록 전체 선택 / 해제
  const handleSelectAllFiltered = () => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.delete(s.id));
      return next;
    });
  };

  // 학생 개별 토글
  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 장바구니에서 학생 개별 제거
  const handleRemoveFromBasket = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // 장바구니 전체 비우기
  const handleClearBasket = () => {
    setSelectedStudentIds(new Set());
    toast({ title: '선택 초기화', description: '선택된 학생 목록을 모두 비웠습니다.' });
  };

  // 최종 선택된 학생 객체 목록 (전교생 풀에서 추출)
  const targetStudents = React.useMemo(() => {
    return allSchoolStudents.filter(s => selectedStudentIds.has(s.id));
  }, [allSchoolStudents, selectedStudentIds]);

  // 일괄 부여 실행 (0ms 즉각 반응)
  const handleExecuteBulkGrant = async () => {
    if (targetStudents.length === 0) {
      toast({ variant: 'destructive', title: '부여할 대상을 선택해주세요.' });
      return;
    }

    const selectedRule = availableRules.find(r => r.id === selectedRuleId);
    const ruleName = selectedRule?.name || (type === 'merit' ? '일괄 상점 항목' : '일괄 벌점 항목');
    const sanitizedPoints = Math.max(1, Math.min(1000, points));
    const studentIds = targetStudents.map(s => s.id);
    const studentsMeta = targetStudents.map(s => ({
      id: s.id,
      student_name: s.student_name,
      student_number: s.student_number,
      major: s.major,
      class_info: s.class_info,
      grade: s.grade || 3
    }));

    // 1. 낙관적 즉각 반영 (0ms) & 모달 닫기
    onSuccess({
      studentIds,
      type,
      points: sanitizedPoints,
      ruleName,
      date,
      memo
    });
    onClose();

    toast({
      title: '상벌점 일괄 부여 완료',
      description: `총 ${studentIds.length}명의 학생에게 [${type === 'merit' ? '상점' : '벌점'}] ${sanitizedPoints}점(${ruleName})이 일괄 부여되었습니다.`
    });

    // 2. 비동기 백그라운드 DB 저장 (<0.08초 완료)
    try {
      const res = await grantMeritDemeritAction({
        studentIds,
        studentsMeta,
        ruleId: selectedRuleId || 'bulk-grant',
        ruleName,
        type,
        points: sanitizedPoints,
        date,
        memo,
        grade: typeof activeGrade === 'number' ? activeGrade : 3,
        academicYear
      });

      if (!res.success) {
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isPending && !open && onClose()}>
      <DialogContent className="sm:max-w-[780px] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        {/* 상단 헤더 */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  상벌점 일괄 부여
                  <Badge variant="outline" className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border-indigo-200">
                    전교생 1·2·3학년 교차 선택 지원
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  여러 학년 및 학급의 학생들을 장바구니에 담아 상점이나 벌점을 한 번에 일괄 부여합니다.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 본문 스크롤 영역 */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* 1. 상벌점 종류 및 항목 설정 카드 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5 shadow-2xs">
            {/* 상점 / 벌점 전환 탭 */}
            <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType('merit')}
                className={cn(
                  "py-2 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
                  type === 'merit' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span>🌟 상점(+) 일괄 부여</span>
              </button>
              <button
                type="button"
                onClick={() => setType('demerit')}
                className={cn(
                  "py-2 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
                  type === 'demerit' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>⚠️ 벌점(-) 일괄 부여</span>
              </button>
            </div>

            {/* 기준 항목 + 점수 + 일자 3열 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700">상벌점 기준 항목 선택</label>
                <Select value={selectedRuleId} onValueChange={handleRuleChange}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 rounded-xl text-xs font-medium">
                    <SelectValue placeholder="기준 항목 선택" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {availableRules.map(rule => (
                      <SelectItem key={rule.id} value={rule.id} className="text-xs">
                        <span className="font-bold text-slate-800">[{rule.category}] {rule.name}</span>
                        <span className={cn("ml-1.5 font-black text-xs", rule.type === 'merit' ? "text-emerald-600" : "text-rose-600")}>
                          ({rule.type === 'merit' ? '+' : '-'}{rule.points}점)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">부여 점수 (자유 수정)</label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={points}
                    onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                    className="h-9 bg-white border-slate-200 rounded-xl text-xs font-black text-center"
                  />
                  <span className="text-xs font-bold text-slate-500">점</span>
                </div>
              </div>
            </div>

            {/* 일자 및 상세 사유 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">부여 일자</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 bg-white border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700">상세 사유 / 활동 내용 (선택)</label>
                <Input
                  placeholder="예: 축제 부스 도우미 봉사, 전교 동아리 활동 우수"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="h-9 bg-white border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. 대상 학생 선택 영역 (학년별 탭 & 전교생 교차 장바구니) */}
          <div className="space-y-3">
            {/* 상단 탭: 학년 전환 (전교생 / 1학년 / 2학년 / 3학년) + 엑셀 붙여넣기 모드 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('select');
                    setTargetGradeTab('ALL');
                  }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1",
                    activeMode === 'select' && targetGradeTab === 'ALL'
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>전교생 통합</span>
                </button>
                {[1, 2, 3].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setActiveMode('select');
                      setTargetGradeTab(g);
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1",
                      activeMode === 'select' && targetGradeTab === g
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <span>{g}학년</span>
                  </button>
                ))}
              </div>

              {/* 엑셀 붙여넣기 모드 버튼 */}
              <Button
                type="button"
                size="sm"
                variant={activeMode === 'paste' ? 'default' : 'outline'}
                onClick={() => setActiveMode(activeMode === 'paste' ? 'select' : 'paste')}
                className={cn(
                  "h-8 text-xs font-bold rounded-xl gap-1.5",
                  activeMode === 'paste' ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                )}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>엑셀/명단 붙여넣기</span>
              </Button>
            </div>

            {activeMode === 'select' ? (
              /* 학년별 / 전교생 학생 체크박스 선택 뷰 */
              <div className="space-y-2.5">
                {/* 필터 툴바 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select 
                    value={targetMajor} 
                    onValueChange={(val) => {
                      setTargetMajor(val);
                      setTargetClass('ALL');
                    }}
                  >
                    <SelectTrigger className="h-8.5 text-xs bg-white border-slate-200 rounded-lg">
                      <SelectValue placeholder="전체 학과" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">전체 학과</SelectItem>
                      {currentMajors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={targetClass} 
                    onValueChange={setTargetClass}
                    disabled={targetMajor === 'ALL'}
                  >
                    <SelectTrigger className="h-8.5 text-xs bg-white border-slate-200 rounded-lg">
                      <SelectValue placeholder={targetMajor === 'ALL' ? '학과 먼저 선택' : '전체 반'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">전체 반</SelectItem>
                      {currentClasses.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="학생 이름, 학번 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 pl-8 text-xs bg-white border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* 전체 선택 / 해제 버튼 */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-500 font-medium">
                    {targetGradeTab === 'ALL' ? '전교생' : `${targetGradeTab}학년`} 조회된 학생 {filteredStudents.length}명
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllFiltered}
                      className="h-6.5 px-2.5 text-[11px] font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 rounded-md"
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      현재 목록 전체 담기
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAllFiltered}
                      className="h-6.5 px-2 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-md"
                    >
                      선택 해제
                    </Button>
                  </div>
                </div>

                {/* 학생 체크박스 스크롤 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[190px] overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                  {filteredStudents.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-xs text-slate-400 italic">
                      일치하는 학생이 없습니다.
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const isChecked = selectedStudentIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleToggleStudent(s.id)}
                          className={cn(
                            "p-2 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition-all text-xs select-none",
                            isChecked 
                              ? "bg-indigo-50/80 border-indigo-300 text-indigo-900 font-bold shadow-2xs" 
                              : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Checkbox 
                              checked={isChecked} 
                              onCheckedChange={() => handleToggleStudent(s.id)}
                              className="pointer-events-none shrink-0" 
                            />
                            <span className="truncate font-extrabold text-slate-900">
                              {s.student_name}
                              <span className="text-[11px] font-bold text-indigo-700 ml-0.5">({formatStudentClassTag(s)})</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            {s.student_number ? `${s.student_number}번` : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* 엑셀 / 텍스트 붙여넣기 뷰 (전교생 자동 탐색) */
              <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">전교생 학생 이름 / 학번 붙여넣기 (1·2·3학년 자동 매칭)</label>
                  <Textarea
                    placeholder="엑셀에서 학생 명단 열을 복사하여 여기에 붙여넣으세요. (1~3학년이 섞여 있어도 자동 인식)&#10;예:&#10;홍길동&#10;3101&#10;김철수&#10;2205"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="h-24 text-xs bg-white resize-none"
                  />
                </div>

                {pastedMatchedStudents.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                      <span>전교생 중 자동 매칭된 학생 ({pastedMatchedStudents.length}명)</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                      {pastedMatchedStudents.map(s => (
                        <Badge key={s.id} variant="secondary" className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-200">
                          {s.student_name}({formatStudentClassTag(s)}) {s.student_number ? `${s.student_number}번` : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleApplyPasted}
                  disabled={pastedMatchedStudents.length === 0}
                  className="w-full h-8.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs"
                >
                  매칭된 {pastedMatchedStudents.length}명 선택 목록에 추가하기
                </Button>
              </div>
            )}

            {/* 3. 실시간 선택 장바구니 (Selected Basket Chips) */}
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-indigo-950">🛒 선택된 대상 장바구니</span>
                  <Badge className={cn("text-xs font-black px-2 py-0.2 rounded-full", targetStudents.length > 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600")}>
                    총 {targetStudents.length}명 담김
                  </Badge>
                </div>
                {targetStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBasket}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    전체 비우기
                  </button>
                )}
              </div>

              {targetStudents.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-1">
                  아직 선택된 학생이 없습니다. 학년 탭을 전환하며 부여할 학생들을 담아보세요.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1">
                  {targetStudents.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-indigo-950 border border-indigo-200 shadow-2xs group"
                    >
                      <span className="font-black text-slate-900">{s.student_name}</span>
                      <span className="text-[11px] text-indigo-700 font-extrabold">({formatStudentClassTag(s)})</span>
                      {s.student_number && <span className="text-[10px] text-slate-400">#{s.student_number}</span>}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromBasket(s.id)}
                        className="h-4 w-4 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 푸터 액션 */}
        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 font-bold">
            선택 인원: <span className="text-indigo-600 font-black text-sm">{targetStudents.length}명</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 border-slate-200"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleExecuteBulkGrant}
              disabled={isPending || targetStudents.length === 0}
              className={cn(
                "h-9 px-5 rounded-xl text-xs font-black text-white shadow-md transition-all",
                type === 'merit' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-rose-600 hover:bg-rose-700 shadow-rose-100"
              )}
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {targetStudents.length}명에게 {type === 'merit' ? '상점' : '벌점'} 일괄 부여하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}