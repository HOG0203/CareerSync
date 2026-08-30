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
}

export function ClassTimetableView({
  data,
  currentWeights = DEFAULT_ACTIVITY_WEIGHTS,
  userAssignedGrade,
  userAssignedClass,
  currentUserFullName,
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
      // 1) 로그인 교사 이름으로 담임 학급 매칭 (1순위)
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

      // 2) 프로필의 assigned_class 또는 assigned_grade로 매칭 (2순위)
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

      // 3) 매칭되지 않는 경우 기본 첫 번째 학반
      if (!selectedClassCode || !data.classes.some(c => c.classCode === selectedClassCode)) {
        const firstClass = data.classes[0];
        setSelectedGrade(firstClass.grade);
        setSelectedDept(firstClass.deptName);
        setSelectedClassCode(firstClass.classCode);
      }
    }
  }, [data, userAssignedClass, userAssignedGrade, currentUserFullName]);

  const [searchFilter, setSearchFilter] = React.useState<string>('');

  // 학반 빠른 검색 (예: 축31, 조진연, 건31, 기22 등 입력 시 해당 학년/학과/반으로 자동 점프)
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

  // 학년 변경 핸들러
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

  // 학과 변경 핸들러
  const handleDeptChange = (dept: string) => {
    setSelectedDept(dept);
    const deptClasses = data.classes.filter(c => c.grade === selectedGrade && c.deptName === dept).sort((a, b) => a.classNum - b.classNum);
    if (deptClasses.length > 0) {
      setSelectedClassCode(deptClasses[0].classCode);
    }
  };

  // 반 변경 핸들러
  const handleClassChange = (classCode: string) => {
    setSelectedClassCode(classCode);
  };

  const selectedClass = React.useMemo(() => {
    return data.classes.find(c => c.classCode === selectedClassCode) || data.classes[0];
  }, [data, selectedClassCode]);

  // 연속 수업(블록타임) rowSpan 셀 병합 계산
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

        // 다음 교시들이 연속 수업인지 확인
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
    <div className="space-y-4">
      {/* 1. 학반 빠른 검색 + 학년/학과/반 3단 연동 드롭다운 필터 바 (인쇄 시 숨김) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* 학반 / 담임교사 빠른 검색창 */}
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="학반, 담임 검색 (예: 축31, 조진연)..."
              value={searchFilter}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-slate-50/70 border-slate-200 rounded-xl"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                title="검색어 지우기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

          {/* 1) 학년 선택 드롭다운 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-500 whitespace-nowrap">학년:</span>
            <Select value={String(selectedGrade)} onValueChange={handleGradeChange}>
              <SelectTrigger className="w-[105px] h-9 text-xs font-black bg-indigo-50/60 border-indigo-200 text-indigo-950 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map(g => (
                  <SelectItem key={g} value={String(g)} className="text-xs font-bold">
                    {g}학년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2) 학과 선택 드롭다운 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-500 whitespace-nowrap">학과:</span>
            <Select value={selectedDept} onValueChange={handleDeptChange}>
              <SelectTrigger className="w-[165px] h-9 text-xs font-black bg-slate-50 border-slate-200 text-slate-800 rounded-xl">
                <SelectValue placeholder="학과 선택" />
              </SelectTrigger>
              <SelectContent>
                {availableDepts.map(d => (
                  <SelectItem key={d} value={d} className="text-xs font-bold">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3) 반 선택 드롭다운 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-500 whitespace-nowrap">반:</span>
            <Select value={selectedClassCode} onValueChange={handleClassChange}>
              <SelectTrigger className="w-[145px] h-9 text-xs font-black bg-indigo-50/60 border-indigo-200 text-indigo-950 rounded-xl">
                <SelectValue placeholder="반 선택" />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map(c => (
                  <SelectItem key={c.classCode} value={c.classCode} className="text-xs font-bold">
                    {c.classNum}반 ({c.classCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 인쇄 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="h-9 text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs self-end md:self-auto"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          학반 시간표 A4 인쇄
        </Button>
      </div>

      {/* 2. 선택된 학반 헤더 배너 (인쇄 시에도 표시) */}
      {selectedClass && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {classDetail?.displayName || selectedClass.displayName}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white shadow-sm">
                  {selectedClass.classCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2.5 flex-wrap">
                <span>{data.academicYear}학년도 {data.semester}학기</span>
                {data.effectiveDate && <span>({data.effectiveDate})</span>}
                {selectedClass.homeroomTeacher ? (
                  <span className="inline-flex items-center gap-1 text-indigo-300 font-bold bg-white/10 px-2 py-0.5 rounded-md">
                    <User className="h-3 w-3 text-indigo-400" />
                    담임교사: {selectedClass.homeroomTeacher} 선생님
                  </span>
                ) : (
                  <span className="text-slate-500">담임교사 미지정</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15">
            <Clock className="h-4 w-4 text-indigo-400" />
            <div>
              <span className="text-[10px] text-slate-300 font-bold block">주당 총 수업</span>
              <span className="text-sm font-black text-white">{selectedClass.totalPeriods}교시</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. 메인 주간 5일 시간표 바둑판 테이블 (연속 수업 셀 병합) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-3 sm:p-5 print:border-none print:shadow-none print:p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-center min-w-[650px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200">
                <th className="py-3 px-2 text-xs font-black w-14 text-slate-500 border-r border-slate-200">
                  교시
                </th>
                {DAYS_OF_WEEK.map(d => (
                  <th key={d.key} className="py-3 px-3 text-xs sm:text-sm font-black text-slate-800 border-r last:border-r-0 border-slate-200">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{d.name}</span>
                      <span className="text-[10px] font-normal text-slate-400">({d.periods}교시)</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map(period => (
                <tr key={period} className="h-[64px] border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {/* 교시 헤더 */}
                  <td className="py-2 px-2 text-xs font-black text-slate-500 bg-slate-50/80 border-r border-slate-200 h-full align-middle">
                    <span className="w-6 h-6 rounded-full bg-white border border-slate-200 shadow-2xs inline-flex items-center justify-center">
                      {period}
                    </span>
                  </td>

                  {/* 요일별 슬롯 카드 (연속수업 셀 병합 렌더링) */}
                  {DAYS_OF_WEEK.map(d => {
                    if (period > d.periods) {
                      return (
                        <td key={d.key} className="p-1.5 border-r last:border-r-0 border-slate-200 bg-slate-50/40 h-full align-middle">
                          <div className="h-full min-h-[52px] rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[10.5px] text-slate-300 italic">
                            -
                          </div>
                        </td>
                      );
                    }

                    const spanInfo = classDaySpans[d.key]?.[period];
                    if (!spanInfo || !spanInfo.shouldRender) {
                      // 이전 교시 셀에 병합되어 렌더링 생략
                      return null;
                    }

                    const slot = spanInfo.slot;

                    if (!slot || (!slot.subjectName && !slot.teacherName)) {
                      return (
                        <td key={d.key} rowSpan={spanInfo.rowSpan} className="p-1.5 border-r last:border-r-0 border-slate-200 align-middle h-full">
                          <div 
                            style={{ minHeight: `${spanInfo.rowSpan * 64 - 12}px` }}
                            className="h-full w-full rounded-xl border border-slate-100 bg-slate-50/30 flex items-center justify-center text-[11px] text-slate-300 font-medium"
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
                        className="p-1.5 border-r last:border-r-0 border-slate-200 align-middle h-full"
                      >
                        <TooltipProvider>
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <div
                                style={{ minHeight: `${spanInfo.rowSpan * 64 - 12}px` }}
                                className={cn(
                                  "w-full h-full p-2 rounded-xl border-[1.5px] transition-all flex flex-col items-center text-center shadow-xs cursor-pointer hover:shadow-md hover:scale-[1.01]",
                                  isMergedBlock 
                                    ? "justify-center py-3 gap-2" 
                                    : "justify-between py-1.5 gap-1",
                                  actInfo.style.bg,
                                  actInfo.style.border,
                                  isHomeroomTeacher && "ring-2 ring-indigo-600 ring-offset-1 font-bold border-indigo-500"
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
                                      "inline-flex items-center gap-0.5 rounded-md font-bold shadow-2xs",
                                      isMergedBlock ? "text-xs px-2.5 py-1" : "text-[10.5px] px-2 py-0.5",
                                      isHomeroomTeacher 
                                        ? "bg-indigo-600 text-white font-black" 
                                        : "bg-slate-100 text-slate-700 border border-slate-200"
                                    )}>
                                      <User className="h-2.5 w-2.5 opacity-70" />
                                      <span>{slot.teacherName}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-xl space-y-1">
                              <p className="font-bold text-indigo-300 flex items-center gap-1">
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
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-slate-400" /> 교사 뱃지 안내:
            </span>
            <span className="inline-flex items-center gap-1 bg-indigo-600 text-white px-2 py-0.5 rounded-md font-bold text-[10px]">
              담임 교사 수업 (인디고 뱃지)
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
              교과 교사 수업
            </span>
          </div>

          <span className="text-slate-400 text-[10.5px]">
            ※ 상단 [학반 시간표 A4 인쇄] 버튼을 누르면 교실 부착용 맞춤 양식으로 인쇄할 수 있습니다.
          </span>
        </div>
      </div>
    </div>
  );
}
