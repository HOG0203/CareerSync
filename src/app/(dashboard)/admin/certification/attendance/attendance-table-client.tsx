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

import { CertificationSkeleton } from '@/components/dashboard/loading-skeleton';

export function AttendanceTableClient({ 
  initialData,
  currentGrade,
  baseYear,
  isAdmin = false
}: { 
  initialData: AttendanceRecord[],
  currentGrade: number,
  baseYear: number,
  isAdmin?: boolean
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [searchTerm, setSearchText] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState('all');
  const [selectedClass, setSelectedClass] = React.useState('all');
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);

  const handleGradeChange = (grade: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('grade', grade.toString());
    startTransition(() => {
      router.push(`/admin/certification/attendance?${params.toString()}`);
    });
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

  if (isPending) {
    return <CertificationSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
      {/* 헤더 바: 제목 줄바꿈 방지 (whitespace-nowrap) 및 모바일 여백 정돈 */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 border-b flex justify-between items-center bg-white min-w-0">

        <div className="flex items-center gap-2 min-w-0 shrink">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 shrink-0" />
          <h2 className="font-black text-slate-800 tracking-tight text-base sm:text-lg whitespace-nowrap truncate">
            전교생 출결 현황
          </h2>
        </div>
        {isAdmin && (
          <div className="shrink-0 ml-2">
            <AttendanceImportModal baseYear={baseYear} />
          </div>
        )}
      </div>

      {/* 필터 바 */}
      <div className="p-3 sm:p-4 border-b flex flex-col md:flex-row md:items-center gap-3 sm:gap-4 bg-white sticky top-0 z-20">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            placeholder="이름/번호 검색..." 
            className="w-full pl-9 h-9 sm:h-10 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" 
            value={searchTerm}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-start w-full md:w-auto">
          {/* 학년 필터 */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border shrink-0">
            {[1, 2, 3].map(g => (
              <Button 
                key={g} 
                variant={currentGrade === g ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleGradeChange(g)}
                className={cn("h-7 sm:h-8 px-2.5 sm:px-4 text-xs font-black rounded-lg", currentGrade === g && "bg-white shadow-sm text-indigo-600")}
              >
                {g}학년
              </Button>
            ))}
          </div>

          {/* 학과 필터 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar max-w-full">
            <Button 
              variant={selectedMajor === 'all' ? "default" : "outline"} 
              size="sm" 
              onClick={() => { setSelectedMajor('all'); setSelectedClass('all'); }}
              className={cn("h-7 sm:h-8 text-xs font-bold shrink-0 rounded-lg", selectedMajor === 'all' && "bg-indigo-600 hover:bg-indigo-700")}
            >
              전체 학과
            </Button>
            {majors.map(m => (
              <Button 
                key={m} 
                variant={selectedMajor === m ? "default" : "outline"} 
                size="sm" 
                onClick={() => { setSelectedMajor(m); setSelectedClass('all'); }}
                className={cn("h-7 sm:h-8 text-xs font-bold shrink-0 rounded-lg", selectedMajor === m && "bg-indigo-600 hover:bg-indigo-700")}
              >
                {m.replace('공업계', '')}
              </Button>
            ))}
          </div>

          {/* 반 필터 */}
          {selectedMajor !== 'all' && classes.length > 0 && (
            <div className="flex items-center gap-1 border-t sm:border-t-0 sm:border-l pt-2 sm:pt-0 sm:pl-3 border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {classes.map(c => (
                <Button 
                  key={c} 
                  variant={selectedClass === c ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setSelectedClass(c)}
                  className="h-7 sm:h-8 px-2.5 sm:px-3 text-[11px] font-bold rounded-lg shrink-0"
                >
                  {c.replace('반', '')}반
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 출결 카드 목록 영역 */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {studentGroups.map((group) => {
            return (
              <div 
                key={group.id} 
                onClick={() => setSelectedStudentId(group.id)}
                className={cn(
                  "group bg-white border-2 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden",
                  group.hasAnyUnexcused ? "border-rose-100 hover:border-rose-200" : "border-slate-100 hover:border-indigo-100"
                )}
              >
                <div className={cn(
                  "absolute -right-2 -top-2 h-16 w-16 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform",
                  group.hasAnyUnexcused ? "bg-rose-500" : "bg-indigo-500"
                )} />

                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className={cn(
                        "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0",
                        group.hasAnyUnexcused ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-500"
                      )}>
                        <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="font-black text-slate-800 text-sm sm:text-base leading-tight truncate">{group.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{group.classInfo.replace('반', '')}반 {group.number}번</span>
                      </div>
                    </div>
                    {group.hasAnyUnexcused ? (
                      <div className="bg-rose-500 text-white p-1 rounded-lg animate-pulse shadow-sm shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-600 p-1 rounded-lg shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                      <GraduationCap className="h-3 w-3 text-slate-400 shrink-0" />
                      <span>{group.gradYear}년 졸업예정</span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-black truncate">
                      {group.major.replace('공업계', '')}
                    </div>
                  </div>

                  {/* 출결 매트릭스 표 */}
                  <div className="pt-2.5 sm:pt-3 border-t border-slate-50">
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
          <div className="py-20 sm:py-32 flex flex-col items-center justify-center text-slate-300 gap-3">
            <div className="bg-white p-5 sm:p-6 rounded-full shadow-sm border border-slate-50">
              <Info className="h-10 w-10 sm:h-12 sm:w-12 opacity-20 text-slate-400" />
            </div>
            <p className="font-black text-slate-400 tracking-tight text-xs sm:text-sm">조회된 학생 출결 정보가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] w-[95vw] sm:w-full overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-2xl sm:rounded-3xl [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors">
          <DialogHeader className="p-4 sm:p-8 bg-slate-900 text-white relative shrink-0">
            <div className="flex items-center gap-3 sm:gap-5 mr-6 sm:mr-8">
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-white/80" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <DialogTitle className="text-lg sm:text-2xl font-black text-white truncate">{selectedGroup?.name}</DialogTitle>
                  <span className="text-[10px] sm:text-[11px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm shrink-0">
                    {selectedGroup?.gradYear}년 졸업예정
                  </span>
                </div>
                <DialogDescription className="text-slate-400 text-xs sm:text-sm font-bold mt-1 sm:mt-1.5 flex items-center gap-2 truncate">
                  <span>{selectedGroup?.major.replace('공업계', '')}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700 shrink-0" />
                  <span>{selectedGroup?.classInfo.replace('반', '')}반 {selectedGroup?.number}번</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 space-y-6 sm:space-y-8 custom-scrollbar">
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <ClipboardList className="h-4 w-4 text-indigo-500 shrink-0" />
                학년별 전체 출결 이력
              </h3>
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[540px]">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 border-r w-20 sm:w-24 text-center">대상 학년</th>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 border-r text-rose-600 bg-rose-50/30 text-center" colSpan={4}>미인정(무단)</th>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 border-r text-blue-600 bg-blue-50/30 text-center" colSpan={4}>질병</th>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 text-center bg-slate-50/30" colSpan={4}>기타</th>
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
                        <td className="px-4 sm:px-6 py-3 sm:py-4 border-r font-black text-slate-700 text-center bg-slate-50/30">{r.grade}학년</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center font-black", r.absent_unexcused > 0 ? "text-rose-600" : "text-slate-300")}>{r.absent_unexcused}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center font-bold", r.late_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.late_unexcused}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center font-bold", r.early_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.early_unexcused}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center font-bold", r.out_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.out_unexcused}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center", r.absent_disease > 0 ? "text-blue-600" : "text-slate-300")}>{r.absent_disease}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center", r.late_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.late_disease}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center", r.early_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.early_disease}</td>
                        <td className={cn("px-2 py-3 sm:py-4 text-center", r.out_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.out_disease}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center", r.absent_other > 0 ? "text-slate-600" : "text-slate-300")}>{r.absent_other}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center", r.late_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.late_other}</td>
                        <td className={cn("px-2 py-3 sm:py-4 border-r text-center", r.early_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.early_other}</td>
                        <td className={cn("px-2 py-3 sm:py-4 text-center", r.out_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.out_other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedGroup?.records.some(r => r.remarks) && (
              <div className="space-y-2.5 sm:space-y-3">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">특기사항 모음</h4>
                <div className="grid gap-2.5 sm:gap-3">
                  {selectedGroup.records.filter(r => r.remarks).map((r, i) => (
                    <div key={i} className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex gap-3 sm:gap-4 items-start">
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

      {/* 푸터 영역 */}
      <div className="px-4 py-3 sm:px-6 sm:py-3 border-t bg-white flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-black text-slate-400 shrink-0">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> 미인정 기록 보유</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> 결석 없는 완벽한 학생</span>
          <span>현재 조회 인원: <span className="text-indigo-600">{studentGroups.length}명</span></span>
        </div>
        <div className="uppercase tracking-widest opacity-50 text-[9px] sm:text-[10px]">CareerSync Attendance Grid v2.0</div>
      </div>
    </div>
  );
}

