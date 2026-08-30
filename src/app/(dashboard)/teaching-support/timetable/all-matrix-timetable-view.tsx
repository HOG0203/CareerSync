'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/all-matrix-timetable-view.tsx
// 전체 교사 시간표 마스터 매트릭스 뷰
// ==============================================================================

import * as React from 'react';
import { 
  ParsedTimetableResult, 
  TeacherTimetableSummary 
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
  Search, 
  Download, 
  Users, 
  GraduationCap, 
  Clock, 
  Scale, 
  Printer,
  X 
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { cn } from '@/lib/utils';

interface AllMatrixTimetableViewProps {
  data: ParsedTimetableResult;
  currentWeights?: ActivityWeightConfig;
  tabSelector?: React.ReactNode;
}

export function AllMatrixTimetableView({
  data,
  currentWeights = DEFAULT_ACTIVITY_WEIGHTS,
  tabSelector,
}: AllMatrixTimetableViewProps) {
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [homeroomOnly, setHomeroomOnly] = React.useState<boolean>(false);

  const filteredTeachers = React.useMemo(() => {
    return data.teachers.filter(t => {
      if (homeroomOnly && !t.homeroomClass) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      return (
        t.teacherName.toLowerCase().includes(q) ||
        t.homeroomClass.toLowerCase().includes(q) ||
        (t.remarks && t.remarks.toLowerCase().includes(q))
      );
    });
  }, [data.teachers, searchTerm, homeroomOnly]);

  const handleExportExcel = () => {
    // 엑셀 내보내기
    const rows: any[][] = [];
    rows.push([`${data.academicYear}학년도 ${data.semester}학기 전체 교사 시간표`]);
    rows.push(['번호', '교사', '담임', '수업교시', '인정시수', '월1', '월2', '월3', '월4', '월5', '월6', '월7', '화1', '화2', '화3', '화4', '화5', '화6', '화7', '수1', '수2', '수3', '수4', '수5', '수6', '목1', '목2', '목3', '목4', '목5', '목6', '금1', '금2', '금3', '금4', '금5', '금6', '비고']);

    filteredTeachers.forEach((t, idx) => {
      const row1 = [idx + 1, t.teacherName, t.homeroomClass, t.rawPeriods, t.weightedHours];
      const row2 = ['', '', '', '', ''];

      DAYS_OF_WEEK.forEach(d => {
        for (let p = 1; p <= d.periods; p++) {
          const slot = t.slots[`${d.key}_${p}`];
          row1.push(slot ? slot.subjectName : '');
          row2.push(slot ? slot.classCode : '');
        }
      });

      row1.push(t.remarks);
      rows.push(row1);
      rows.push(row2);
    });

    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '전체교사시간표');
    xlsx.writeFile(wb, `${data.academicYear}학년도_${data.semester}학기_전체교사시간표_내보내기.xlsx`);
  };

  return (
    <div className="space-y-3">
      {/* 1. 단일 통합 컨트롤 바 (탭 + 검색 캡슐 + 담임 캡슐 + 다운로드) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs print:hidden">
        <div className="flex items-center flex-wrap gap-2 flex-1">
          {/* 탭 전환기 */}
          {tabSelector}

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

          {/* 교사/담임 검색 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="교사명, 담임반 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-7 text-xs bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-700"
                title="검색어 지우기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 담임교사 필터 캡슐 버튼 */}
          <button
            type="button"
            onClick={() => setHomeroomOnly(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all border shadow-2xs h-7.5",
              homeroomOnly 
                ? "bg-amber-50 text-amber-900 border-amber-300 font-black" 
                : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100/80"
            )}
          >
            <GraduationCap className={cn("h-3.5 w-3.5", homeroomOnly ? "text-amber-600" : "text-slate-400")} />
            담임교사만
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 hidden sm:inline-block">
            총 <strong className="text-amber-600 font-black">{filteredTeachers.length}</strong>명 교사
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border-slate-200/80 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-slate-700 shadow-2xs transition-all"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            엑셀 다운로드
          </Button>
        </div>
      </div>

      {/* 2. 매트릭스 테이블 카드 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden p-3 sm:p-4">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-center text-xs min-w-[1200px]">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b-2 border-slate-200 text-[11.5px]">
                <th className="py-2.5 px-2 font-black w-10 border-r border-slate-200">번호</th>
                <th className="py-2.5 px-3 font-black w-24 border-r border-slate-200">교사명</th>
                <th className="py-2.5 px-2 font-black w-16 border-r border-slate-200">담임</th>
                <th className="py-2.5 px-2 font-black w-14 border-r border-slate-200">교시</th>
                <th className="py-2.5 px-2 font-black w-16 border-r border-slate-300 text-indigo-700 bg-indigo-50/70">인정시수</th>

                {/* 요일별 헤더 */}
                {DAYS_OF_WEEK.map(d => (
                  <th
                    key={d.key}
                    colSpan={d.periods}
                    className="py-2.5 px-2 font-black border-r last:border-r-0 border-slate-300 bg-slate-100/90 text-slate-800 text-[12px]"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{d.name}</span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded-full">
                        {d.periods}교시
                      </span>
                    </div>
                  </th>
                ))}
              </tr>

              {/* 교시 서브 헤더 */}
              <tr className="bg-slate-50 text-slate-500 text-[10.5px] border-b border-slate-200">
                <th className="py-1 px-1 border-r border-slate-200" colSpan={5}></th>
                {DAYS_OF_WEEK.map(d => (
                  <React.Fragment key={d.key}>
                    {Array.from({ length: d.periods }, (_, idx) => (
                      <th key={idx} className="py-1 px-1 font-bold border-r border-slate-200 last:border-r-0 w-8 text-slate-600">
                        {idx + 1}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredTeachers.map((teacher, tIdx) => {
                const homeroomInfo = parseClassCode(teacher.homeroomClass);

                return (
                  <React.Fragment key={teacher.teacherName}>
                    {/* 상단 행: 과목명 */}
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td rowSpan={2} className="py-2 px-1 font-bold text-slate-400 bg-slate-50/60 border-r border-slate-200 text-[11px]">
                        {tIdx + 1}
                      </td>
                      <td rowSpan={2} className="py-2 px-2 font-black text-slate-900 border-r border-slate-200 whitespace-nowrap bg-white">
                        {teacher.teacherName}
                      </td>
                      <td rowSpan={2} className="py-2 px-1 border-r border-slate-200 bg-white">
                        {teacher.homeroomClass ? (
                          <span className={cn("inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black shadow-2xs", homeroomInfo.color.badge)}>
                            {teacher.homeroomClass}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">-</span>
                        )}
                      </td>
                      <td rowSpan={2} className="py-2 px-1 font-bold text-slate-700 border-r border-slate-200 text-[11px] bg-white">
                        {teacher.rawPeriods}
                      </td>
                      <td rowSpan={2} className="py-2 px-1 font-black text-indigo-700 bg-indigo-50/50 border-r border-slate-300 text-[11.5px]">
                        {teacher.weightedHours}h
                      </td>

                      {/* 요일별 과목 슬롯 */}
                      {DAYS_OF_WEEK.map(d => (
                        <React.Fragment key={d.key}>
                          {Array.from({ length: d.periods }, (_, idx) => {
                            const p = idx + 1;
                            const slot = teacher.slots[`${d.key}_${p}`];
                            const actInfo = getActivityInfo(slot?.subjectName || '', currentWeights);

                            return (
                              <td 
                                key={p} 
                                className={cn(
                                  "py-1 px-0.5 border-r border-slate-200/80 last:border-r-0 font-bold text-[10.5px] truncate max-w-[42px]",
                                  slot ? actInfo.style.bg : "bg-slate-50/40 text-slate-300"
                                )}
                              >
                                {slot ? slot.subjectName : ''}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* 하단 행: 학반 코드 */}
                    <tr className="border-b-2 border-slate-200 bg-slate-50/30 hover:bg-slate-50/60 transition-colors">
                      {DAYS_OF_WEEK.map(d => (
                        <React.Fragment key={d.key}>
                          {Array.from({ length: d.periods }, (_, idx) => {
                            const p = idx + 1;
                            const slot = teacher.slots[`${d.key}_${p}`];
                            const classInfo = parseClassCode(slot?.classCode || '');

                            return (
                              <td 
                                key={p} 
                                className={cn(
                                  "py-0.5 px-0.5 border-r border-slate-200/80 last:border-r-0 text-[9.5px] font-black",
                                  slot ? classInfo.color.text : "bg-slate-50/40 text-slate-300"
                                )}
                              >
                                {slot ? slot.classCode : ''}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
