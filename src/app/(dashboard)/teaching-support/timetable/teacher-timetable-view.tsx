'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/teacher-timetable-view.tsx
// 교사별 시간표 주간 뷰 (시수 가중치 계산, 학반 툴팁, A4 인쇄)
// ==============================================================================

import * as React from 'react';
import { 
  ParsedTimetableResult, 
  TeacherTimetableSummary, 
  TimetableSlot 
} from '@/lib/timetable/parser';
import { 
  DAYS_OF_WEEK, 
  parseClassCode, 
  getActivityInfo, 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS 
} from '@/lib/timetable/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Printer, 
  Clock, 
  Scale, 
  Sparkles, 
  Search, 
  GraduationCap,
  Calendar,
  Building,
  Info,
  X
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface TeacherTimetableViewProps {
  data: ParsedTimetableResult;
  currentWeights?: ActivityWeightConfig;
  currentUsername?: string;
  currentUserFullName?: string;
  tabSelector?: React.ReactNode;
}

export function TeacherTimetableView({
  data,
  currentWeights = DEFAULT_ACTIVITY_WEIGHTS,
  currentUsername,
  currentUserFullName,
  tabSelector,
}: TeacherTimetableViewProps) {
  const [selectedTeacherName, setSelectedTeacherName] = React.useState<string>('');
  const [searchFilter, setSearchFilter] = React.useState<string>('');

  // 로그인 사용자와 일치하는 교사 자동 선택 또는 첫 번째 교사 선택
  React.useEffect(() => {
    if (data.teachers.length > 0) {
      const match = data.teachers.find(t => 
        t.teacherName === currentUserFullName || 
        t.teacherName === currentUsername
      );
      if (match) {
        setSelectedTeacherName(match.teacherName);
      } else if (!selectedTeacherName || !data.teachers.some(t => t.teacherName === selectedTeacherName)) {
        setSelectedTeacherName(data.teachers[0].teacherName);
      }
    }
  }, [data, currentUserFullName, currentUsername]);

  const filteredTeachers = React.useMemo(() => {
    if (!searchFilter.trim()) return data.teachers;
    const q = searchFilter.trim().toLowerCase();
    return data.teachers.filter(t => t.teacherName.toLowerCase().includes(q));
  }, [data.teachers, searchFilter]);

  // 검색어 입력 시 즉시 1위 검색 결과(교사명)로 자동 선택 & 시간표 실시간 전환
  const handleSearchChange = (query: string) => {
    setSearchFilter(query);
    if (!query.trim()) return;

    const q = query.trim().toLowerCase();
    const matches = data.teachers.filter(t => t.teacherName.toLowerCase().includes(q));

    if (matches.length > 0) {
      setSelectedTeacherName(matches[0].teacherName);
    }
  };

  const handleClearSearch = () => {
    setSearchFilter('');
  };

  const selectedTeacher = React.useMemo(() => {
    return data.teachers.find(t => t.teacherName === selectedTeacherName) || data.teachers[0];
  }, [data, selectedTeacherName]);

  // 가중치 재계산
  const weightedBreakdown = React.useMemo(() => {
    if (!selectedTeacher) return { totalRaw: 0, totalWeighted: 0, items: [] as { name: string; count: number; weight: number; total: number }[] };

    let totalRaw = 0;
    const actCountMap: Record<string, { count: number; weight: number }> = {};

    Object.values(selectedTeacher.slots).forEach(slot => {
      totalRaw += 1;
      const sub = slot.subjectName.trim();
      let actKey = '일반 교과';
      let w = 1.0;

      if (sub.includes('자율')) {
        actKey = '자율활동';
        w = currentWeights['자율'] ?? 1.5;
      } else if (sub.includes('동아')) {
        actKey = '동아리';
        w = currentWeights['동아'] ?? 0.5;
      } else if (sub.includes('진로')) {
        actKey = '진로활동';
        w = currentWeights['진로'] ?? 1.0;
      } else if (sub.includes('성직')) {
        actKey = '성직';
        w = currentWeights['성직'] ?? 1.0;
      }

      if (!actCountMap[actKey]) {
        actCountMap[actKey] = { count: 0, weight: w };
      }
      actCountMap[actKey].count += 1;
    });

    let totalWeighted = 0;
    const items = Object.entries(actCountMap).map(([name, info]) => {
      const itemTotal = info.count * info.weight;
      totalWeighted += itemTotal;
      return {
        name,
        count: info.count,
        weight: info.weight,
        total: Math.round(itemTotal * 10) / 10
      };
    });

    return {
      totalRaw,
      totalWeighted: Math.round(totalWeighted * 10) / 10,
      items
    };
  }, [selectedTeacher, currentWeights]);

  // 연속 수업(블록타임) rowSpan 셀 병합 계산
  const teacherDaySpans = React.useMemo(() => {
    const map: Record<string, Record<number, { shouldRender: boolean; rowSpan: number; slot?: TimetableSlot; isBlock: boolean; totalBlockPeriods: number }>> = {};

    DAYS_OF_WEEK.forEach(d => {
      map[d.key] = {};
      let p = 1;
      while (p <= d.periods) {
        const slot = selectedTeacher?.slots[`${d.key}_${p}`];
        if (!slot || (!slot.subjectName && !slot.classCode)) {
          map[d.key][p] = { shouldRender: true, rowSpan: 1, slot: undefined, isBlock: false, totalBlockPeriods: 1 };
          p++;
          continue;
        }

        let count = 1;
        let nextP = p + 1;
        while (nextP <= d.periods) {
          const nextSlot = selectedTeacher?.slots[`${d.key}_${nextP}`];
          if (
            nextSlot &&
            nextSlot.isContinuous &&
            nextSlot.subjectName === slot.subjectName &&
            nextSlot.classCode === slot.classCode
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
  }, [selectedTeacher]);

  const handlePrint = () => {
    window.print();
  };

  const homeroomInfo = selectedTeacher ? parseClassCode(selectedTeacher.homeroomClass) : null;

  return (
    <div className="space-y-3">
      {/* 1. 단일 통합 컨트롤 바 (탭 + 교사 선택 캡슐 + 검색 캡슐 + 인쇄) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs print:hidden">
        <div className="flex items-center flex-wrap gap-2 flex-1">
          {/* 탭 전환기 */}
          {tabSelector}

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

          {/* 교사 선택 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <Select
              value={selectedTeacherName}
              onValueChange={setSelectedTeacherName}
            >
              <SelectTrigger className="w-[140px] sm:w-[160px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue placeholder="교사 선택" />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-xl shadow-xl border-slate-200">
                {(filteredTeachers.length > 0 ? filteredTeachers : data.teachers).map(t => (
                  <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium py-1.5">
                    <span className="font-bold text-slate-800">{t.teacherName}</span>
                    {t.homeroomClass && (
                      <span className="ml-1.5 text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                        {t.homeroomClass}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400"> ({t.rawPeriods}시수)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 교사 실시간 검색 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 flex-1 max-w-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="교사명 검색..."
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

      {/* 2. 메인 시간표 카드 (상단 인라인 프로필 헤더 + 바둑판 테이블) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* 카드 상단 인라인 프로필 헤더 바 */}
        {selectedTeacher && (
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-slate-900">{selectedTeacher.teacherName} 선생님</span>
                {selectedTeacher.homeroomClass ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <GraduationCap className="h-3 w-3" />
                    담임: {homeroomInfo?.displayName || selectedTeacher.homeroomClass}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    비담임
                  </span>
                )}
              </div>

              {selectedTeacher.remarks && (
                <span className="text-xs text-amber-600 font-medium">※ {selectedTeacher.remarks}</span>
              )}
            </div>

            {/* 시수 요약 뱃지 */}
            <TooltipProvider>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200/80 cursor-help shadow-2xs self-start sm:self-auto text-xs">
                    <span>수업: <strong className="text-slate-900 font-black">{weightedBreakdown.totalRaw}교시</strong></span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-blue-600 font-bold">
                      <Sparkles className="h-3 w-3 text-blue-600" />
                      인정: <strong className="font-black text-blue-700">{weightedBreakdown.totalWeighted}시간</strong>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-3 max-w-xs bg-slate-900 text-white text-xs rounded-xl shadow-xl">
                  <p className="font-bold text-blue-300 mb-1 flex items-center gap-1">
                    <Scale className="h-3 w-3" /> 활동별 가중치 내역
                  </p>
                  <div className="space-y-1 text-[11px] text-slate-300">
                    {weightedBreakdown.items.map(it => (
                      <div key={it.name} className="flex justify-between gap-3">
                        <span>• {it.name} ({it.count}교시 × {it.weight}배)</span>
                        <span className="font-bold text-white">{it.total}시간</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-700 pt-1 mt-1 font-bold text-white flex justify-between">
                      <span>합계 인정 시수</span>
                      <span className="text-blue-300">{weightedBreakdown.totalWeighted}시간</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                    const spanInfo = teacherDaySpans[d.key]?.[period];
                    const hasActiveSlot = Boolean(spanInfo?.slot && (spanInfo.slot.subjectName || spanInfo.slot.classCode));

                    if (period > d.periods && !hasActiveSlot) {
                      // 6교시 마감 요일(수,목,금)의 7교시 빈칸
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

                    if (!slot || (!slot.subjectName && !slot.classCode)) {
                      // 공강 시간 (빈 슬롯)
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

                    const classInfo = parseClassCode(slot.classCode);
                    const actInfo = getActivityInfo(slot.subjectName, currentWeights);
                    const isHomeroomClass = selectedTeacher?.homeroomClass && slot.classCode === selectedTeacher.homeroomClass;
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
                                  isHomeroomClass && "ring-2 ring-indigo-600 ring-offset-1 font-bold border-indigo-500"
                                )}
                              >
                                {/* 블록 교시 범위 라벨 (예: 1~3교시) */}
                                {isMergedBlock && (
                                  <span className="text-[10px] font-black text-indigo-700 bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-full shadow-2xs">
                                    {period}~{period + spanInfo.rowSpan - 1}교시 연속
                                  </span>
                                )}

                                {/* 과목명 / 활동명 */}
                                <div className="flex items-center justify-center gap-1 font-black text-slate-900 truncate max-w-full">
                                  <span className={cn(isMergedBlock ? "text-base sm:text-lg font-black tracking-tight" : "text-xs")}>
                                    {slot.subjectName}
                                  </span>
                                  {actInfo.isActivity && (
                                    <span className={cn("text-[9px] px-1 py-0.2 rounded font-extrabold", actInfo.style.badge)}>
                                      {actInfo.weight * spanInfo.rowSpan}h
                                    </span>
                                  )}
                                </div>

                                {/* 학반 코드 뱃지 */}
                                {slot.classCode && (
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    <span className={cn(
                                      "inline-flex items-center font-black shadow-2xs",
                                      isMergedBlock ? "text-xs px-2.5 py-1 rounded-xl" : "text-[10.5px] px-2 py-0.5 rounded-lg",
                                      classInfo.color.badge
                                    )}>
                                      {slot.classCode}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-900 text-white text-xs p-3 rounded-2xl shadow-xl space-y-1">
                              <p className="font-bold text-indigo-300 flex items-center gap-1">
                                <GraduationCap className="h-3.5 w-3.5" />
                                {classInfo.displayName}
                              </p>
                              <p className="text-[11px] text-slate-300">
                                과목: <strong className="text-white">{slot.subjectName}</strong>
                                {isMergedBlock && ` (${spanInfo.rowSpan}교시 연속 수업)`}
                                {actInfo.isActivity && ` [${actInfo.label}]`}
                              </p>
                              {isHomeroomClass && (
                                <p className="text-[10.5px] text-amber-300 font-semibold">
                                  ★ 담임 학급 수업 시간입니다.
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

        {/* 하단 범례 안내 바 */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 print:hidden">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-indigo-600" /> 특별활동 범례:
            </span>
            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg font-bold">
              자율활동 ({currentWeights['자율'] ?? 1.5}h)
            </span>
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
              동아리 ({currentWeights['동아'] ?? 0.5}h)
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold">
              진로활동 ({currentWeights['진로'] ?? 1.0}h)
            </span>
            <span className="inline-flex items-center gap-1 bg-white text-indigo-700 border-2 border-indigo-400 px-2 py-0.5 rounded-lg font-bold">
              담임 학급 (링 테두리)
            </span>
          </div>

          <span className="text-slate-400 text-[10.5px]">
            ※ 학반 뱃지에 마우스를 올리면 학과 및 학년/반 상세 정보가 표시됩니다.
          </span>
        </div>
      </div>
    </div>
  </div>
  );
}
