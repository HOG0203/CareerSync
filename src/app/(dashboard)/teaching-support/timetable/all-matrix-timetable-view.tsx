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
  Printer 
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { cn } from '@/lib/utils';

interface AllMatrixTimetableViewProps {
  data: ParsedTimetableResult;
  currentWeights?: ActivityWeightConfig;
}

export function AllMatrixTimetableView({
  data,
  currentWeights = DEFAULT_ACTIVITY_WEIGHTS,
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
    <div className="space-y-4">
      {/* 검색 및 필터 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="교사명, 담임반 검색 (예: 강은주, 기22)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50/70 border-slate-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setHomeroomOnly(prev => !prev)}
            className={cn(
              "px-3 h-9 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5",
              homeroomOnly 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            담임교사만
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-bold text-slate-500 mr-1">
            총 <strong className="text-indigo-600 font-black">{filteredTeachers.length}</strong>명 교사
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-9 text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50 text-emerald-700 shadow-2xs"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            엑셀 다운로드 (.xlsx)
          </Button>
        </div>
      </div>

      {/* 매트릭스 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-3 sm:p-4">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs min-w-[1200px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200 text-[11.5px]">
                <th className="py-2.5 px-2 font-black w-10 border-r border-slate-200">번호</th>
                <th className="py-2.5 px-3 font-black w-20 border-r border-slate-200">교사명</th>
                <th className="py-2.5 px-2 font-black w-16 border-r border-slate-200">담임</th>
                <th className="py-2.5 px-2 font-black w-14 border-r border-slate-200">교시</th>
                <th className="py-2.5 px-2 font-black w-16 border-r border-slate-300 text-indigo-700 bg-indigo-50/50">인정시수</th>

                {/* 요일별 헤더 */}
                {DAYS_OF_WEEK.map(d => (
                  <th 
                    key={d.key} 
                    colSpan={d.periods} 
                    className="py-2 px-1 font-black text-slate-800 border-r last:border-r-0 border-slate-200 bg-slate-50"
                  >
                    {d.name} ({d.periods}교시)
                  </th>
                ))}
              </tr>

              {/* 교시 서브 헤더 */}
              <tr className="bg-slate-50 text-slate-500 text-[10.5px] border-b border-slate-200">
                <th className="py-1 px-1 border-r border-slate-200" colSpan={5}></th>
                {DAYS_OF_WEEK.map(d => (
                  <React.Fragment key={d.key}>
                    {Array.from({ length: d.periods }, (_, idx) => (
                      <th key={idx} className="py-1 px-1 font-bold border-r border-slate-200 last:border-r-0 w-8">
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
                    <tr className="border-b border-slate-100 hover:bg-indigo-50/20 transition-colors">
                      <td rowSpan={2} className="py-2 px-1 font-bold text-slate-400 bg-slate-50/40 border-r border-slate-200 text-[11px]">
                        {tIdx + 1}
                      </td>
                      <td rowSpan={2} className="py-2 px-2 font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {teacher.teacherName}
                      </td>
                      <td rowSpan={2} className="py-2 px-1 border-r border-slate-200">
                        {teacher.homeroomClass ? (
                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-black", homeroomInfo.color.badge)}>
                            {teacher.homeroomClass}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">-</span>
                        )}
                      </td>
                      <td rowSpan={2} className="py-2 px-1 font-bold text-slate-700 border-r border-slate-200 text-[11px]">
                        {teacher.rawPeriods}
                      </td>
                      <td rowSpan={2} className="py-2 px-1 font-black text-indigo-700 bg-indigo-50/30 border-r border-slate-300 text-[11.5px]">
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
                                  "py-1 px-0.5 border-r border-slate-200 last:border-r-0 font-bold text-[10.5px] truncate max-w-[40px]",
                                  slot ? actInfo.style.bg : "bg-slate-50/30 text-slate-300"
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
                    <tr className="border-b-2 border-slate-200 bg-slate-50/20 hover:bg-indigo-50/20 transition-colors">
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
                                  "py-0.5 px-0.5 border-r border-slate-200 last:border-r-0 text-[9.5px] font-black",
                                  slot ? classInfo.color.text : "bg-slate-50/30 text-slate-300"
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
