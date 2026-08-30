'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/class-timetable-view.tsx
// 학반별 시간표 주간 뷰 (학년/학과 필터, 담당교사 표시, 교실 부착용 A4 인쇄)
// ==============================================================================

import * as React from 'react';
import { 
  ParsedTimetableResult, 
  ClassTimetableSummary, 
  TimetableSlot 
} from '@/lib/timetable/parser';
import { 
  DAYS_OF_WEEK, 
  parseClassCode, 
  getActivityInfo, 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS,
  DEPARTMENT_CODE_MAP 
} from '@/lib/timetable/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Building2, 
  Printer, 
  GraduationCap, 
  User, 
  Clock, 
  Layers, 
  Info,
  Check,
  ChevronDown,
  Search,
  LayoutGrid,
  X
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface ClassTimetableViewProps {
  data: ParsedTimetableResult;
  currentWeights?: ActivityWeightConfig;
  userAssignedGrade?: number;
  userAssignedClass?: string;
  currentUserFullName?: string;
  tabSelector?: React.ReactNode;
}

export function ClassTimetableView({
  data,
  currentWeights = DEFAULT_ACTIVITY_WEIGHTS,
  userAssignedGrade,
  userAssignedClass,
  currentUserFullName,
  tabSelector,
}: ClassTimetableViewProps) {
  const [selectedGrade, setSelectedGrade] = React.useState<number>(1);
  const [selectedDept, setSelectedDept] = React.useState<string>('자동화기계과');
  const [selectedClassCode, setSelectedClassCode] = React.useState<string>('');

  // 1. 해당 학년에 개설된 학과 목록
  const availableDepts = React.useMemo(() => {
    const gradeClasses = data.classes.filter(c => c.grade === selectedGrade);
    const depts = Array.from(new Set(gradeClasses.map(c => c.deptName).filter(Boolean)));
    return depts.sort((a, b) => a.localeCompare(b, 'ko'));
  }, [data.classes, selectedGrade]);

  // 2. 해당 학년 및 학과에 개설된 반 목록
  const availableClasses = React.useMemo(() => {
    const list = data.classes.filter(c => c.grade === selectedGrade && c.deptName === selectedDept);
    return list.sort((a, b) => a.classNum - b.classNum);
  }, [data.classes, selectedGrade, selectedDept]);

  // 로그인 교사의 담임반이 있으면 해당 학년, 학과, 반으로 자동 기본 선택
  React.useEffect(() => {
    if (data.classes.length > 0) {
      if (currentUserFullName) {
        const cleanName = currentUserFullName.trim();
        const matchedByTeacher = data.classes.find(c => 
          c.homeroomTeacher && (
            c.homeroomTeacher.trim() === cleanName ||
            cleanName.includes(c.homeroomTeacher.trim()) ||
            c.homeroomTeacher.trim().includes(cleanName)
          )
        );
        if (matchedByTeacher) {
          setSelectedGrade(matchedByTeacher.grade);
          setSelectedDept(matchedByTeacher.deptName);
          setSelectedClassCode(matchedByTeacher.classCode);
          return;
        }
      }

      if (userAssignedClass) {
        const cleanUserClass = userAssignedClass.trim();
        const matched = data.classes.find(c => 
          c.classCode === cleanUserClass || 
          c.displayName.includes(cleanUserClass) ||
          (userAssignedGrade === c.grade && String(c.classNum) === cleanUserClass)
        );
        if (matched) {
          setSelectedGrade(matched.grade);
          setSelectedDept(matched.deptName);
          setSelectedClassCode(matched.classCode);
          return;
        }
      }

      if (!selectedClassCode || !data.classes.some(c => c.classCode === selectedClassCode)) {
        const firstClass = data.classes[0];
        setSelectedGrade(firstClass.grade);
        setSelectedDept(firstClass.deptName);
        setSelectedClassCode(firstClass.classCode);
      }
    }
  }, [data, userAssignedClass, userAssignedGrade, currentUserFullName]);

  const [searchFilter, setSearchFilter] = React.useState<string>('');

  const handleSearchChange = (query: string) => {
    setSearchFilter(query);
    if (!query.trim()) return;

    const q = query.trim().toLowerCase();
    const match = data.classes.find(c => 
      c.classCode.toLowerCase().includes(q) ||
      c.deptName.toLowerCase().includes(q) ||
      c.displayName.toLowerCase().includes(q) ||
      (c.homeroomTeacher && c.homeroomTeacher.toLowerCase().includes(q))
    );

    if (match) {
      setSelectedGrade(match.grade);
      setSelectedDept(match.deptName);
      setSelectedClassCode(match.classCode);
    }
  };

  const handleClearSearch = () => {
    setSearchFilter('');
  };

  const handleGradeChange = (gradeStr: string) => {
    const grade = parseInt(gradeStr);
    setSelectedGrade(grade);
    const gradeClasses = data.classes.filter(c => c.grade === grade);
    const depts = Array.from(new Set(gradeClasses.map(c => c.deptName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
    const nextDept = depts.includes(selectedDept) ? selectedDept : (depts[0] || '');
    setSelectedDept(nextDept);

    const nextClasses = gradeClasses.filter(c => c.deptName === nextDept).sort((a, b) => a.classNum - b.classNum);
    if (nextClasses.length > 0) {
      setSelectedClassCode(nextClasses[0].classCode);
    }
  };

  const handleDeptChange = (dept: string) => {
    setSelectedDept(dept);
    const deptClasses = data.classes.filter(c => c.grade === selectedGrade && c.deptName === dept).sort((a, b) => a.classNum - b.classNum);
    if (deptClasses.length > 0) {
      setSelectedClassCode(deptClasses[0].classCode);
    }
  };

  const handleClassChange = (classCode: string) => {
    setSelectedClassCode(classCode);
  };

  const selectedClass = React.useMemo(() => {
    return data.classes.find(c => c.classCode === selectedClassCode) || data.classes[0];
  }, [data, selectedClassCode]);

  const classDaySpans = React.useMemo(() => {
    const map: Record<string, Record<number, { shouldRender: boolean; rowSpan: number; slot?: TimetableSlot; isBlock: boolean; totalBlockPeriods: number }>> = {};

    DAYS_OF_WEEK.forEach(d => {
      map[d.key] = {};
      let p = 1;
      while (p <= d.periods) {
        const slot = selectedClass?.slots[`${d.key}_${p}`];
        if (!slot || (!slot.subjectName && !slot.teacherName)) {
          map[d.key][p] = { shouldRender: true, rowSpan: 1, slot: undefined, isBlock: false, totalBlockPeriods: 1 };
          p++;
          continue;
        }

        let count = 1;
        let nextP = p + 1;
        while (nextP <= d.periods) {
          const nextSlot = selectedClass?.slots[`${d.key}_${nextP}`];
          if (
            nextSlot &&
            nextSlot.isContinuous &&
            nextSlot.subjectName === slot.subjectName &&
            nextSlot.teacherName === slot.teacherName
          ) {
            count++;
            map[d.key][nextP] = { shouldRender: false, rowSpan: 1, slot: nextSlot, isBlock: true, totalBlockPeriods: 0 };
            nextP++;
          } else {
            break;
          }
        }

        map[d.key][p] = { shouldRender: true, rowSpan: count, slot, isBlock: count > 1, totalBlockPeriods: count };
        p = nextP;
      }
    });

    return map;
  }, [selectedClass]);

  const handlePrint = () => {
    window.print();
  };

  const classDetail = selectedClass ? parseClassCode(selectedClass.classCode) : null;

  return (
    <div className="space-y-3">
      {/* 1. 단일 통합 컨트롤 바 (탭 + 학년/학과/반 캡슐 + 검색 + 인쇄) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs print:hidden">
        <div className="flex items-center flex-wrap gap-2 flex-1">
          {/* 탭 전환기 */}
          {tabSelector}

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

          {/* 학년 선택 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <GraduationCap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <Select value={String(selectedGrade)} onValueChange={handleGradeChange}>
              <SelectTrigger className="w-[75px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                {[1, 2, 3].map(g => (
                  <SelectItem key={g} value={String(g)} className="text-xs font-medium py-1.5">
                    {g}학년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 학과 선택 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <Select value={selectedDept} onValueChange={handleDeptChange}>
              <SelectTrigger className="w-[130px] sm:w-[150px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 truncate">
                <SelectValue placeholder="학과 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                {availableDepts.map(d => (
                  <SelectItem key={d} value={d} className="text-xs font-medium py-1.5">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 반 선택 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <LayoutGrid className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <Select value={selectedClassCode} onValueChange={handleClassChange}>
              <SelectTrigger className="w-[95px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue placeholder="반 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                {availableClasses.map(c => (
                  <SelectItem key={c.classCode} value={c.classCode} className="text-xs font-medium py-1.5">
                    {c.classNum}반 ({c.classCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 학반/교사 검색 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 flex-1 max-w-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="학반, 담임 검색..."
              value={searchFilter}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full h-7 text-xs bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-slate-400 hover:text-slate-700"
                title="검색어 지우기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 인쇄 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="h-8 text-xs font-bold gap-1.5 rounded-xl border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs shrink-0"
        >
          <Printer className="h-3.5 w-3.5 text-slate-500" />
          A4 인쇄
        </Button>
      </div>

      {/* 2. 메인 시간표 카드 (상단 인라인 학반 헤더 + 바둑판 테이블) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* 카드 상단 인라인 학반 헤더 바 */}
        {selectedClass && (
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-slate-900">
                  {classDetail?.displayName || selectedClass.displayName}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedClass.classCode}
                </span>
              </div>

              {selectedClass.homeroomTeacher ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100">
                  <User className="h-3 w-3 text-emerald-600" />
                  담임: {selectedClass.homeroomTeacher} 선생님
                </span>
              ) : (
                <span className="text-xs text-slate-400">담임 미지정</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs self-start sm:self-auto">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              <span>주당 총 수업: <strong className="text-slate-900 font-black">{selectedClass.totalPeriods}교시</strong></span>
            </div>
          </div>
        )}

        {/* 바둑판 테이블 영역 */}
        <div className="p-3 sm:p-4 overflow-hidden">
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-center min-w-[680px]">
              <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b-2 border-slate-200">
                <th className="py-3 px-2 text-xs font-black w-14 text-slate-500 border-r border-slate-200">
                  교시
                </th>
                {DAYS_OF_WEEK.map(d => (
                  <th key={d.key} className="py-3 px-3 text-xs sm:text-sm font-black text-slate-800 border-r last:border-r-0 border-slate-200">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{d.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded-full">
                        {d.periods}교시
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map(period => (
                <tr key={period} className="h-[64px] border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {/* 교시 헤더 */}
                  <td className="py-2 px-2 text-xs font-black text-slate-600 bg-slate-50/80 border-r border-slate-200 h-full align-middle">
                    <span className="w-7 h-7 rounded-full bg-white border border-slate-200/90 shadow-2xs inline-flex items-center justify-center font-black text-slate-700">
                      {period}
                    </span>
                  </td>

                  {/* 요일별 슬롯 카드 (연속수업 셀 병합 렌더링) */}
                  {DAYS_OF_WEEK.map(d => {
                    const spanInfo = classDaySpans[d.key]?.[period];
                    const hasActiveSlot = Boolean(spanInfo?.slot && (spanInfo.slot.subjectName || spanInfo.slot.teacherName));

                    if (period > d.periods && !hasActiveSlot) {
                      return (
                        <td key={d.key} className="p-1.5 border-r last:border-r-0 border-slate-200/80 bg-slate-50/40 h-full align-middle">
                          <div className="h-full min-h-[52px] rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-[10.5px] text-slate-300 italic">
                            -
                          </div>
                        </td>
                      );
                    }

                    if (!spanInfo || !spanInfo.shouldRender) {
                      return null;
                    }

                    const slot = spanInfo.slot;

                    if (!slot || (!slot.subjectName && !slot.teacherName)) {
                      return (
                        <td key={d.key} rowSpan={spanInfo.rowSpan} className="p-1.5 border-r last:border-r-0 border-slate-200/80 align-middle h-full">
                          <div 
                            style={{ minHeight: `${spanInfo.rowSpan * 64 - 12}px` }}
                            className="h-full w-full rounded-2xl border border-slate-100 bg-slate-50/40 flex items-center justify-center text-[11px] text-slate-300 font-medium"
                          >
                            공강
                          </div>
                        </td>
                      );
                    }

                    const actInfo = getActivityInfo(slot.subjectName, currentWeights);
                    const classInfo = parseClassCode(slot.classCode);
                    const isHomeroomTeacher = selectedClass?.homeroomTeacher && slot.teacherName === selectedClass.homeroomTeacher;
                    const isMergedBlock = spanInfo.rowSpan > 1;

                    return (
                      <td 
                        key={d.key} 
                        rowSpan={spanInfo.rowSpan} 
                        className="p-1.5 border-r last:border-r-0 border-slate-200/80 align-middle h-full"
                      >
                        <TooltipProvider>
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <div
                                style={{ minHeight: `${spanInfo.rowSpan * 64 - 12}px` }}
                                className={cn(
                                  "w-full h-full p-2 rounded-2xl border-[1.5px] transition-all flex flex-col items-center text-center shadow-2xs cursor-pointer hover:shadow-md hover:scale-[1.01]",
                                  isMergedBlock 
                                    ? "justify-center py-3 gap-2" 
                                    : "justify-between py-1.5 gap-1",
                                  actInfo.style.bg,
                                  actInfo.style.border,
                                  isHomeroomTeacher && "ring-2 ring-emerald-600 ring-offset-1 font-bold border-emerald-500"
                                )}
                              >
                                {/* 과목명 */}
                                <div className="flex items-center justify-center gap-1 font-black text-slate-900 truncate max-w-full">
                                  <span className={cn(isMergedBlock ? "text-base sm:text-lg font-black tracking-tight" : "text-xs")}>
                                    {slot.subjectName}
                                  </span>
                                </div>

                                {/* 담당 교사 뱃지 */}
                                {slot.teacherName && (
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    <span className={cn(
                                      "inline-flex items-center gap-0.5 rounded-lg font-bold shadow-2xs",
                                      isMergedBlock ? "text-xs px-2.5 py-1" : "text-[10.5px] px-2 py-0.5",
                                      isHomeroomTeacher 
                                        ? "bg-emerald-600 text-white font-black" 
                                        : "bg-slate-100 text-slate-700 border border-slate-200"
                                    )}>
                                      <User className="h-2.5 w-2.5 opacity-70" />
                                      <span>{slot.teacherName}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-900 text-white text-xs p-3 rounded-2xl shadow-xl space-y-1">
                              <p className="font-bold text-emerald-300 flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                담당 교사: {slot.teacherName} 선생님
                              </p>
                              <p className="text-[11px] text-slate-300">
                                과목: <strong className="text-white">{slot.subjectName}</strong>
                                {isMergedBlock && ` (${spanInfo.rowSpan}교시 연속 수업)`}
                                {actInfo.isActivity && ` [${actInfo.label}]`}
                              </p>
                              {isHomeroomTeacher && (
                                <p className="text-[10.5px] text-amber-300 font-semibold">
                                  ★ 담임 선생님 수업 시간입니다.
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 안내 바 */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 print:hidden">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-emerald-600" /> 교사 뱃지 안내:
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white px-2 py-0.5 rounded-lg font-bold text-[10px]">
              담임 교사 수업 (에메랄드 뱃지)
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg font-bold text-[10px]">
              교과 교사 수업
            </span>
          </div>

          <span className="text-slate-400 text-[10.5px]">
            ※ 상단 [학반 시간표 A4 인쇄] 버튼을 누르면 교실 부착용 맞춤 양식으로 인쇄할 수 있습니다.
          </span>
        </div>
      </div>
    </div>
  </div>
  );
}
