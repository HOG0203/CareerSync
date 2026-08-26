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
  ClipboardList,
  Loader2,
  RotateCw
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

import { getCachedAllAttendanceRecords, getAllAttendanceRecords, clearAttendanceCache } from './actions';
import { CertificationDataSkeleton } from '@/components/dashboard/loading-skeleton';

interface StudentAttendanceGroup {
  id: string;
  name: string;
  number: string;
  major: string;
  classInfo: string;
  gradYear: number;
  records: AttendanceRecord[];
  stats: {
    unexcused: { absent: number; late: number; early: number; out: number };
    disease: { absent: number; late: number; early: number; out: number };
    other: { absent: number; late: number; early: number; out: number };
  };
  hasAnyUnexcused: boolean;
}

export function AttendanceTableClient({ 
  initialData,
  currentGrade,
  baseYear,
  isAdmin = false,
  userProfile
}: { 
  initialData: AttendanceRecord[],
  currentGrade: number,
  baseYear: number,
  isAdmin?: boolean,
  userProfile?: any
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 학년별 인메모리 캐싱 (0ms 즉각 탭 전환)
  const [activeGrade, setActiveGrade] = React.useState<number>(currentGrade);
  const [gradeDataMap, setGradeDataMap] = React.useState<Record<number, AttendanceRecord[]>>({
    [currentGrade]: initialData,
  });
  const [isLoadingGrade, setIsLoadingGrade] = React.useState<boolean>(false);

  // 서버로부터 전달받은 initialData 동기화
  React.useEffect(() => {
    setGradeDataMap(prev => ({
      ...prev,
      [currentGrade]: initialData
    }));
  }, [initialData, currentGrade]);

  const [searchTerm, setSearchText] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState(() => {
    if (!isAdmin && userProfile?.role === 'teacher' && userProfile?.assigned_major) {
      return userProfile.assigned_major;
    }
    return 'all';
  });
  const [selectedClass, setSelectedClass] = React.useState(() => {
    if (!isAdmin && userProfile?.role === 'teacher' && userProfile?.assigned_class) {
      return userProfile.assigned_class;
    }
    return 'all';
  });

  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);

  const handleGradeChange = async (targetGradeNum: number) => {
    if (targetGradeNum === activeGrade) return;
    setActiveGrade(targetGradeNum);
    setSelectedClass('all');
    setSelectedMajor('all');

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('grade', String(targetGradeNum));
      window.history.replaceState(null, '', url.toString());
    }

    if (!gradeDataMap[targetGradeNum]) {
      setIsLoadingGrade(true);
      try {
        const data = await getCachedAllAttendanceRecords(baseYear, targetGradeNum);
        setGradeDataMap(prev => ({ ...prev, [targetGradeNum]: data as any[] }));
      } catch (err) {
        console.error('Failed to load attendance data:', err);
      } finally {
        setIsLoadingGrade(false);
      }
    }
  };

  // 실시간 강제 새로고침 (캐시 무효화 후 라이브 DB 재조회)
  const refreshAllGrades = async (targetGrade = activeGrade) => {
    setIsLoadingGrade(true);
    try {
      await clearAttendanceCache(targetGrade);
      const data = await getAllAttendanceRecords(baseYear, targetGrade, true);
      setGradeDataMap(prev => ({ ...prev, [targetGrade]: data as any[] }));
    } catch (err) {
      console.error('Failed to refresh attendance data:', err);
    } finally {
      setIsLoadingGrade(false);
    }
  };

  const showSkeleton = isLoadingGrade;
  const currentData = gradeDataMap[activeGrade] || [];

  // 학생별 데이터 그룹화 및 필터링
  const studentGroups: StudentAttendanceGroup[] = React.useMemo(() => {
    const groups: Record<string, StudentAttendanceGroup> = {};

    currentData.forEach(item => {
      const s = item.students;
      if (!s) return;

      const sid = item.student_id;
      if (!groups[sid]) {
        groups[sid] = {
          id: sid,
          name: s.student_name,
          number: s.student_number,
          major: s.major,
          classInfo: s.class_info,
          gradYear: s.graduation_year,
          records: [],
          stats: {
            unexcused: { absent: 0, late: 0, early: 0, out: 0 },
            disease: { absent: 0, late: 0, early: 0, out: 0 },
            other: { absent: 0, late: 0, early: 0, out: 0 }
          },
          hasAnyUnexcused: false
        };
      }

      const g = groups[sid];
      g.records.push(item);

      // 통계 합산
      g.stats.unexcused.absent += (item.absent_unexcused || 0);
      g.stats.unexcused.late += (item.late_unexcused || 0);
      g.stats.unexcused.early += (item.early_unexcused || 0);
      g.stats.unexcused.out += (item.out_unexcused || 0);

      g.stats.disease.absent += (item.absent_disease || 0);
      g.stats.disease.late += (item.late_disease || 0);
      g.stats.disease.early += (item.early_disease || 0);
      g.stats.disease.out += (item.out_disease || 0);

      g.stats.other.absent += (item.absent_other || 0);
      g.stats.other.late += (item.late_other || 0);
      g.stats.other.early += (item.early_other || 0);
      g.stats.other.out += (item.out_other || 0);

      if ((item.absent_unexcused || 0) > 0 || (item.late_unexcused || 0) > 0 || (item.early_unexcused || 0) > 0 || (item.out_unexcused || 0) > 0) {
        g.hasAnyUnexcused = true;
      }
    });

    // 클라이언트 필터링 및 정렬
    return Object.values(groups).filter(g => {
      const matchMajor = selectedMajor === 'all' || g.major === selectedMajor;
      const matchClass = selectedClass === 'all' || g.classInfo === selectedClass;
      const matchSearch = g.name.includes(searchTerm) || g.number.includes(searchTerm);
      return matchMajor && matchClass && matchSearch;
    }).sort((a, b) => {
      // 학과 순 정렬
      const idxA = MAJOR_SORT_ORDER.indexOf(a.major);
      const idxB = MAJOR_SORT_ORDER.indexOf(b.major);
      const majorDiff = (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      if (majorDiff !== 0) return majorDiff;

      // 학급 순 정렬
      const classDiff = a.classInfo.localeCompare(b.classInfo, 'ko');
      if (classDiff !== 0) return classDiff;

      // 번호 순 정렬
      return parseInt(a.number || '0') - parseInt(b.number || '0');
    });
  }, [currentData, selectedMajor, selectedClass, searchTerm]);

  const majors = React.useMemo(() => {
    const set = new Set(currentData.map(d => d.students?.major).filter(Boolean));
    return Array.from(set).sort((a, b) => {
      const idxA = MAJOR_SORT_ORDER.indexOf(a!);
      const idxB = MAJOR_SORT_ORDER.indexOf(b!);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    }) as string[];
  }, [currentData]);

  const classes = React.useMemo(() => {
    if (selectedMajor === 'all') return [];
    const set = new Set(currentData.filter(d => d.students?.major === selectedMajor).map(d => d.students?.class_info));
    return Array.from(set).sort();
  }, [currentData, selectedMajor]);

  const selectedGroup = React.useMemo(() => 
    selectedStudentId ? studentGroups.find(g => g.id === selectedStudentId) : null
  , [selectedStudentId, studentGroups]);


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
        {(isAdmin || userProfile?.role === 'teacher') && (
          <div className="shrink-0 ml-2">
            <AttendanceImportModal baseYear={baseYear} onSuccess={() => refreshAllGrades(activeGrade)} />
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
                variant={activeGrade === g ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleGradeChange(g)}
                className={cn("h-7 sm:h-8 px-2.5 sm:px-4 text-xs font-black rounded-lg items-center gap-1", activeGrade === g && "bg-white shadow-sm text-indigo-600")}
              >
                {g}학년
                {isLoadingGrade && activeGrade === g && <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />}
              </Button>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              title="데이터 실시간 새로고침"
              onClick={() => refreshAllGrades(activeGrade)}
              disabled={isLoadingGrade}
              className="h-7 sm:h-8 px-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5", isLoadingGrade && "animate-spin text-indigo-600")} />
            </Button>
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

      {/* 로딩 시 하단 데이터 영역만 회전 로더 스켈레톤 전환 */}
      {showSkeleton ? (
        <CertificationDataSkeleton />
      ) : (

        <>

          {/* 출결 카드 목록 영역 */}
          <div className="flex-1 overflow-auto p-3 sm:p-6">

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5 sm:gap-3">
          {studentGroups.map((group) => {
            return (
              <div 
                key={group.id} 
                onClick={() => setSelectedStudentId(group.id)}
                className={cn(
                  "group bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs hover:shadow-md transition-all cursor-pointer relative overflow-hidden hover:border-indigo-400",
                  group.hasAnyUnexcused ? "border-rose-200 bg-rose-50/20" : "border-slate-200"
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                        group.hasAnyUnexcused ? "bg-rose-100 text-rose-600" : "bg-indigo-50 text-indigo-600"
                      )}>
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="font-black text-slate-800 text-xs sm:text-sm leading-tight truncate">{group.name}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{group.classInfo.replace('반', '')}반 {group.number}번</span>
                      </div>
                    </div>
                    {group.hasAnyUnexcused ? (
                      <div className="bg-rose-500 text-white p-0.5 rounded-md animate-pulse shadow-xs shrink-0">
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-600 p-0.5 rounded-md shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold px-0.5">
                    <span className="truncate text-slate-600 font-black">{group.major.replace('공업계', '')}</span>
                    <span className="text-slate-400 shrink-0">{group.gradYear}년</span>
                  </div>

                  {/* 출결 매트릭스 표 */}
                  <div className="pt-1.5 border-t border-slate-100">
                    <table className="w-full text-[8px] border-collapse bg-slate-50/70 rounded-md overflow-hidden border border-slate-100">
                      <thead>
                        <tr className="text-slate-400 font-black uppercase text-[7px] border-b border-slate-100">
                          <th className="py-0.5 pl-1 text-left border-r border-slate-100">구분</th>
                          <th className="py-0.5">결</th><th className="py-0.5">지</th><th className="py-0.5">조</th><th className="py-0.5">과</th>
                        </tr>
                      </thead>
                      <tbody className="font-bold text-center">
                        <tr className="border-b border-slate-100/50">
                          <td className="py-0.5 pl-1 text-left text-rose-500 font-black border-r border-slate-100">미인정</td>
                          <td className={cn(group.stats.unexcused.absent > 0 && "text-rose-600 font-black bg-rose-50")}>{group.stats.unexcused.absent}</td>
                          <td className={cn(group.stats.unexcused.late > 0 && "text-rose-500")}>{group.stats.unexcused.late}</td>
                          <td className={cn(group.stats.unexcused.early > 0 && "text-rose-500")}>{group.stats.unexcused.early}</td>
                          <td className={cn(group.stats.unexcused.out > 0 && "text-rose-500")}>{group.stats.unexcused.out}</td>
                        </tr>
                        <tr className="border-b border-slate-100/50">
                          <td className="py-0.5 pl-1 text-left text-blue-500 border-r border-slate-100">질병</td>
                          <td className="text-slate-500">{group.stats.disease.absent}</td>
                          <td className="text-slate-500">{group.stats.disease.late}</td>
                          <td className="text-slate-500">{group.stats.disease.early}</td>
                          <td className="text-slate-500">{group.stats.disease.out}</td>
                        </tr>
                        <tr>
                          <td className="py-0.5 pl-1 text-left text-slate-400 border-r border-slate-100">기타</td>
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
        <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] w-[95vw] sm:w-full overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-2xl sm:rounded-3xl bg-white">
          <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mr-6 sm:mr-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-rose-600" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <DialogTitle className="text-lg sm:text-2xl font-extrabold flex items-center gap-2 text-slate-900 truncate">
                    {selectedGroup?.name}
                    <span className="text-xs bg-rose-600 text-white px-2.5 py-0.5 rounded-full font-bold shrink-0">
                      {selectedGroup?.number}번
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-xs sm:text-sm font-bold uppercase tracking-wide mt-1 truncate">
                    {selectedGroup?.major.replace('공업계', '')} • {selectedGroup?.classInfo.replace('반', '')}반 • {selectedGroup?.gradYear}년 졸업예정
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-0.5 sm:mb-1">미인정 결석</p>
                <p className="text-lg sm:text-2xl font-black text-rose-600">
                  {selectedGroup?.stats?.unexcused?.absent ? `${selectedGroup.stats.unexcused.absent}회` : '0회'}
                </p>
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
        </>
      )}
    </div>
  );
}



