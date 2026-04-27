'use client';

import * as React from 'react';
import { 
  Search, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Info,
  GraduationCap,
  User,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { AttendanceImportModal } from './attendance-import-modal';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

interface AttendanceRecord {
  id: string;
  student_id: string;
  academic_year: number;
  grade: number;
  semester: number;
  school_days: number;
  absent_disease: number;
  absent_unexcused: number;
  absent_other: number;
  late_disease: number;
  late_unexcused: number;
  late_other: number;
  early_disease: number;
  early_unexcused: number;
  early_other: number;
  out_disease: number;
  out_unexcused: number;
  out_other: number;
  remarks: string;
  students: {
    student_name: string;
    student_number: string;
    major: string;
    class_info: string;
    graduation_year: number;
  };
}

export function AttendanceTableClient({ 
  initialData,
  currentGrade,
  baseYear
}: { 
  initialData: AttendanceRecord[],
  currentGrade: number,
  baseYear: number
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchText] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState('all');
  const [selectedClass, setSelectedClass] = React.useState('all');
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);

  const handleGradeChange = (grade: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('grade', grade.toString());
    router.push(`/admin/grades/summary/attendance?${params.toString()}`);
  };

  // 학생별 데이터 그룹화 및 필터링
  const studentGroups = React.useMemo(() => {
    const groups: Record<string, {
      id: string;
      name: string;
      number: string;
      major: string;
      classInfo: string;
      gradYear: number;
      records: AttendanceRecord[];
      stats: {
        unexcused: { absent: 0, late: 0, early: 0, out: 0 },
        disease: { absent: 0, late: 0, early: 0, out: 0 },
        other: { absent: 0, late: 0, early: 0, out: 0 }
      };
      hasAnyUnexcused: boolean;
    }> = {};

    initialData.forEach(item => {
      const sid = item.student_id;
      if (!groups[sid]) {
        const s = item.students || {};
        groups[sid] = {
          id: sid,
          name: s.student_name || '미상',
          number: s.student_number || '0',
          major: s.major || '미지정',
          classInfo: s.class_info || '미정',
          gradYear: s.graduation_year || 0,
          records: [],
          stats: {
            unexcused: { absent: 0, late: 0, early: 0, out: 0 },
            disease: { absent: 0, late: 0, early: 0, out: 0 },
            other: { absent: 0, late: 0, early: 0, out: 0 }
          },
          hasAnyUnexcused: false
        };
      }
      groups[sid].records.push(item);
      
      // 통계 합산 (전 학년 통합)
      groups[sid].stats.unexcused.absent += item.absent_unexcused;
      groups[sid].stats.unexcused.late += item.late_unexcused;
      groups[sid].stats.unexcused.early += item.early_unexcused;
      groups[sid].stats.unexcused.out += item.out_unexcused;

      groups[sid].stats.disease.absent += item.absent_disease;
      groups[sid].stats.disease.late += item.late_disease;
      groups[sid].stats.disease.early += item.early_disease;
      groups[sid].stats.disease.out += item.out_disease;

      groups[sid].stats.other.absent += item.absent_other;
      groups[sid].stats.other.late += item.late_other;
      groups[sid].stats.other.early += item.early_other;
      groups[sid].stats.other.out += item.out_other;
      
      if (item.absent_unexcused > 0 || item.late_unexcused > 0 || item.early_unexcused > 0 || item.out_unexcused > 0) {
        groups[sid].hasAnyUnexcused = true;
      }
    });

    return Object.values(groups)
      .filter(g => {
        const matchMajor = selectedMajor === 'all' || g.major === selectedMajor;
        const matchClass = selectedClass === 'all' || g.classInfo === selectedClass;
        const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.number.includes(searchTerm);
        return matchMajor && matchClass && matchSearch;
      })
      .sort((a, b) => {
        if (a.major !== b.major) return (MAJOR_SORT_ORDER.indexOf(a.major) || 99) - (MAJOR_SORT_ORDER.indexOf(b.major) || 99);
        if (a.classInfo !== b.classInfo) return a.classInfo.localeCompare(b.classInfo);
        return parseInt(a.number) - parseInt(b.number);
      });
  }, [initialData, searchTerm, selectedMajor, selectedClass]);

  const majors = React.useMemo(() => {
    const set = new Set(initialData.map(d => d.students?.major).filter(Boolean));
    return Array.from(set).sort((a, b) => (MAJOR_SORT_ORDER.indexOf(a) || 99) - (MAJOR_SORT_ORDER.indexOf(b) || 99));
  }, [initialData]);

  const classes = React.useMemo(() => {
    if (selectedMajor === 'all') return [];
    const set = new Set(initialData.filter(d => d.students?.major === selectedMajor).map(d => d.students?.class_info));
    return Array.from(set).sort();
  }, [initialData, selectedMajor]);

  const selectedGroup = React.useMemo(() => 
    selectedStudentId ? studentGroups.find(g => g.id === selectedStudentId) : null
  , [selectedStudentId, studentGroups]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="px-6 py-4 border-b flex justify-between items-center bg-white">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          <h2 className="font-black text-slate-800 tracking-tight text-lg">전교생 출결 현황</h2>
        </div>
        <AttendanceImportModal baseYear={baseYear} />
      </div>

      <div className="p-4 border-b flex flex-wrap items-center gap-4 bg-white sticky top-0 z-20">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            placeholder="이름/번호 검색..." 
            className="w-full pl-9 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" 
            value={searchTerm}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border">
          {[1, 2, 3].map(g => (
            <Button 
              key={g} 
              variant={currentGrade === g ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleGradeChange(g)}
              className={cn("h-8 px-4 text-xs font-black rounded-lg", currentGrade === g && "bg-white shadow-sm text-indigo-600")}
            >
              {g}학년
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <Button 
            variant={selectedMajor === 'all' ? "default" : "outline"} 
            size="sm" 
            onClick={() => { setSelectedMajor('all'); setSelectedClass('all'); }}
            className={cn("h-8 text-xs font-bold shrink-0 rounded-lg", selectedMajor === 'all' && "bg-indigo-600 hover:bg-indigo-700")}
          >
            전체 학과
          </Button>
          {majors.map(m => (
            <Button 
              key={m} 
              variant={selectedMajor === m ? "default" : "outline"} 
              size="sm" 
              onClick={() => { setSelectedMajor(m); setSelectedClass('all'); }}
              className={cn("h-8 text-xs font-bold shrink-0 rounded-lg", selectedMajor === m && "bg-indigo-600 hover:bg-indigo-700")}
            >
              {m.replace('공업계', '')}
            </Button>
          ))}
        </div>

        {selectedMajor !== 'all' && classes.length > 0 && (
          <div className="flex items-center gap-1 pl-4 border-l">
            {classes.map(c => (
              <Button 
                key={c} 
                variant={selectedClass === c ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setSelectedClass(c)}
                className="h-8 px-3 text-[11px] font-bold rounded-lg"
              >
                {c.replace('반', '')}반
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {studentGroups.map((group) => {
            return (
              <div 
                key={group.id} 
                onClick={() => setSelectedStudentId(group.id)}
                className={cn(
                  "group bg-white border-2 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden",
                  group.hasAnyUnexcused ? "border-rose-100 hover:border-rose-200" : "border-slate-100 hover:border-indigo-100"
                )}
              >
                <div className={cn(
                  "absolute -right-2 -top-2 h-16 w-16 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform",
                  group.hasAnyUnexcused ? "bg-rose-500" : "bg-indigo-500"
                )} />

                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        group.hasAnyUnexcused ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-500"
                      )}>
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-black text-slate-800 text-base leading-tight">{group.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{group.classInfo.replace('반', '')}반 {group.number}번</span>
                      </div>
                    </div>
                    {group.hasAnyUnexcused ? (
                      <div className="bg-rose-500 text-white p-1 rounded-lg animate-pulse shadow-sm">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-600 p-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                      <GraduationCap className="h-3 w-3 text-slate-400" />
                      <span>{group.gradYear}년 졸업예정</span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-black truncate">
                      {group.major.replace('공업계', '')}
                    </div>
                  </div>

                  {/* [핵심] 초소형 출결 매트릭스 표 */}
                  <div className="pt-3 border-t border-slate-50">
                    <table className="w-full text-[8.5px] border-collapse bg-slate-50/50 rounded-lg overflow-hidden border border-slate-100">
                      <thead>
                        <tr className="text-slate-400 font-black uppercase text-[7px] border-b border-slate-100">
                          <th className="py-1 pl-1.5 text-left border-r border-slate-100">구분</th>
                          <th className="py-1">결</th><th className="py-1">지</th><th className="py-1">조</th><th className="py-1">과</th>
                        </tr>
                      </thead>
                      <tbody className="font-bold text-center">
                        <tr className="border-b border-slate-100/50">
                          <td className="py-1 pl-1.5 text-left text-rose-500 font-black border-r border-slate-100">미인정</td>
                          <td className={cn(group.stats.unexcused.absent > 0 && "text-rose-600 font-black")}>{group.stats.unexcused.absent}</td>
                          <td className={cn(group.stats.unexcused.late > 0 && "text-rose-500")}>{group.stats.unexcused.late}</td>
                          <td className={cn(group.stats.unexcused.early > 0 && "text-rose-500")}>{group.stats.unexcused.early}</td>
                          <td className={cn(group.stats.unexcused.out > 0 && "text-rose-500")}>{group.stats.unexcused.out}</td>
                        </tr>
                        <tr className="border-b border-slate-100/50">
                          <td className="py-1 pl-1.5 text-left text-blue-500 border-r border-slate-100">질병</td>
                          <td className="text-slate-500">{group.stats.disease.absent}</td>
                          <td className="text-slate-500">{group.stats.disease.late}</td>
                          <td className="text-slate-500">{group.stats.disease.early}</td>
                          <td className="text-slate-500">{group.stats.disease.out}</td>
                        </tr>
                        <tr>
                          <td className="py-1 pl-1.5 text-left text-slate-400 border-r border-slate-100">기타</td>
                          <td className="text-slate-400">{group.stats.other.absent}</td>
                          <td className="text-slate-400">{group.stats.other.late}</td>
                          <td className="text-slate-400">{group.stats.other.early}</td>
                          <td className="text-slate-400">{group.stats.other.out}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {studentGroups.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center text-slate-300 gap-3">
            <div className="bg-white p-6 rounded-full shadow-sm border border-slate-50">
              <Info className="h-12 w-12 opacity-20 text-slate-400" />
            </div>
            <p className="font-black text-slate-400 tracking-tight">조회된 학생 출결 정보가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors">
          <DialogHeader className="p-8 bg-slate-900 text-white relative">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                <User className="h-8 w-8 text-white/80" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-black text-white">{selectedGroup?.name}</DialogTitle>
                  <span className="text-[11px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm">
                    {selectedGroup?.gradYear}년 졸업예정
                  </span>
                </div>
                <DialogDescription className="text-slate-400 text-sm font-bold mt-1.5 flex items-center gap-2">
                  <span>{selectedGroup?.major.replace('공업계', '')}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>{selectedGroup?.classInfo.replace('반', '')}반 {selectedGroup?.number}번</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <ClipboardList className="h-4 w-4 text-indigo-500" />
                학년별 전체 출결 이력
              </h3>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b">
                    <tr>
                      <th className="px-6 py-4 border-r w-24 text-center">대상 학년</th>
                      <th className="px-6 py-4 border-r text-rose-600 bg-rose-50/30 text-center" colSpan={4}>미인정(무단)</th>
                      <th className="px-6 py-4 border-r text-blue-600 bg-blue-50/30 text-center" colSpan={4}>질병</th>
                      <th className="px-6 py-4 text-center bg-slate-50/30" colSpan={4}>기타</th>
                    </tr>
                    <tr className="bg-slate-50/30 text-[9px] text-slate-400 border-b">
                      <th className="border-r"></th>
                      <th className="px-2 py-2 border-r text-center">결석</th><th className="px-2 py-2 border-r text-center">지각</th><th className="px-2 py-2 border-r text-center">조퇴</th><th className="px-2 py-2 border-r text-center">결과</th>
                      <th className="px-2 py-2 border-r text-center">결석</th><th className="px-2 py-2 border-r text-center">지각</th><th className="px-2 py-2 border-r text-center">조퇴</th><th className="px-2 py-2 border-r text-center">결과</th>
                      <th className="px-2 py-2 border-r text-center">결석</th><th className="px-2 py-2 border-r text-center">지각</th><th className="px-2 py-2 border-r text-center">조퇴</th><th className="px-2 py-2 text-center">결과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedGroup?.records.sort((a,b) => a.grade - b.grade).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 border-r font-black text-slate-700 text-center bg-slate-50/30">{r.grade}학년</td>
                        <td className={cn("px-2 py-4 border-r text-center font-black", r.absent_unexcused > 0 ? "text-rose-600" : "text-slate-300")}>{r.absent_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center font-bold", r.late_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.late_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center font-bold", r.early_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.early_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center font-bold", r.out_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.out_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.absent_disease > 0 ? "text-blue-600" : "text-slate-300")}>{r.absent_disease}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.late_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.late_disease}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.early_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.early_disease}</td>
                        <td className={cn("px-2 py-4 text-center", r.out_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.out_disease}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.absent_other > 0 ? "text-slate-600" : "text-slate-300")}>{r.absent_other}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.late_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.late_other}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.early_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.early_other}</td>
                        <td className={cn("px-2 py-4 text-center", r.out_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.out_other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedGroup?.records.some(r => r.remarks) && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">특기사항 모음</h4>
                <div className="grid gap-3">
                  {selectedGroup.records.filter(r => r.remarks).map((r, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 items-start">
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black shrink-0">{r.grade}학년</span>
                      <p className="text-xs text-slate-600 leading-relaxed italic">"{r.remarks}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="px-6 py-3 border-t bg-white flex items-center justify-between text-[10px] font-black text-slate-400">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> 미인정 기록 보유 (경고)</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> 결석 없는 완벽한 학생</span>
          <span>현재 조회 인원: <span className="text-indigo-600">{studentGroups.length}명</span></span>
        </div>
        <div className="uppercase tracking-widest opacity-50">CareerSync Attendance Grid v2.0</div>
      </div>
    </div>
  );
}
