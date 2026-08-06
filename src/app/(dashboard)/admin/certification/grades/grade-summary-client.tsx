'use client';

import * as React from 'react';
import { 
  Search, 
  Trophy, 
  User, 
  ChevronRight,
  Download,
  Loader2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { getStudentScoresById } from '@/app/students/actions';

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GradeImportModal } from './grade-import-modal';

interface StudentSummary {
  id: string;
  name: string;
  number: string;
  major: string;
  classInfo: string;
  currentGrade: number;
  finalScore: number;
  subjectCount: number;
  gradeCounts: Record<string, number>;
  totalRank: number;
  schoolTotal: number;
  classRank: number;
  classTotal: number;
}

import { CertificationDataSkeleton } from '@/components/dashboard/loading-skeleton';

export function GradeSummaryClient({ 
  initialSummaries, 
  weights,
  currentGrade, // 서버에서 결정된 학년
  isAdmin = false,
  userProfile
}: { 
  initialSummaries: StudentSummary[], 
  weights: Record<string, number>,
  currentGrade: number,
  isAdmin?: boolean,
  userProfile?: any
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
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
  const [currentPage, setCurrentPage] = React.useState(1);
  const [detailedScores, setDetailedScores] = React.useState<any[]>([]);
  const [isDetailLoading, setIsDetailedLoading] = React.useState(false);
  const PAGE_SIZE = 50;

  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>({
    key: 'totalRank',
    direction: 'asc'
  });

  const [pendingGrade, setPendingGrade] = React.useState<number | null>(null);

  React.useEffect(() => {
    setPendingGrade(null);
  }, [currentGrade]);

  const handleGradeChange = (grade: number) => {
    if (grade === currentGrade) return;
    setPendingGrade(grade);
    const params = new URLSearchParams(searchParams.toString());
    params.set('grade', grade.toString());
    startTransition(() => {
      router.push(`/admin/certification/grades?${params.toString()}`);
    });
  };

  const activeGrade = pendingGrade !== null ? pendingGrade : currentGrade;
  const showSkeleton = isPending || (pendingGrade !== null && pendingGrade !== currentGrade);




  // 클라이언트 사이드 필터링 (학과, 반, 검색어)
  const filteredData = React.useMemo(() => {
    let filtered = initialSummaries.filter(s => {
      const matchMajor = selectedMajor === 'all' || s.major === selectedMajor;
      const matchClass = selectedClass === 'all' || s.classInfo === selectedClass;
      const matchSearch = s.name.includes(searchTerm) || s.number.includes(searchTerm);
      return matchMajor && matchClass && matchSearch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let valA: any = (a as any)[sortConfig.key];
        let valB: any = (b as any)[sortConfig.key];
        if (typeof valA === 'string') {
          return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      });
    }

    return filtered;
  }, [initialSummaries, searchTerm, selectedMajor, selectedClass, sortConfig]);

  // 상세 성적 온디맨드 로딩
  React.useEffect(() => {
    if (selectedStudentId) {
      setIsDetailedLoading(true);
      getStudentScoresById(selectedStudentId).then(scores => {
        setDetailedScores(scores);
        setIsDetailedLoading(false);
      });
    } else {
      setDetailedScores([]);
    }
  }, [selectedStudentId]);

  // 필터 변경 시 1페이지로 리셋
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMajor, selectedClass, sortConfig]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'desc' };
    });
  };

  const majors = React.useMemo(() => {
    const allMajors = Array.from(new Set(initialSummaries.map(s => s.major))).filter(Boolean);
    return allMajors.sort((a, b) => {
      const idxA = MAJOR_SORT_ORDER.indexOf(a);
      const idxB = MAJOR_SORT_ORDER.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [initialSummaries]);

  const availableClasses = React.useMemo(() => {
    if (selectedMajor === 'all') return [];
    const classes = new Set(initialSummaries.filter(s => s.major === selectedMajor).map(s => s.classInfo));
    return Array.from(classes).sort();
  }, [initialSummaries, selectedMajor]);

  const selectedStudent = React.useMemo(() => 
    selectedStudentId ? initialSummaries.find(s => s.id === selectedStudentId) : null
  , [selectedStudentId, initialSummaries]);

  const groupedDetails = React.useMemo(() => {
    if (detailedScores.length === 0) return null;
    const groups: Record<string, any[]> = {};
    detailedScores.forEach(r => {
      const semesterKey = `${r.grade}학년 ${r.semester}학기`;
      if (!groups[semesterKey]) groups[semesterKey] = [];
      groups[semesterKey].push(r);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [detailedScores]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
      {/* 헤더 바: 페이지 타이틀 및 성적 데이터 업로드 버튼 */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 border-b flex justify-between items-center bg-white min-w-0 shrink-0">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 shrink-0" />
          <h2 className="font-black text-slate-800 tracking-tight text-base sm:text-lg whitespace-nowrap truncate">
            성적 관리 및 석차 조회
          </h2>
        </div>
        {isAdmin && (
          <div className="shrink-0 ml-2">
            <GradeImportModal />
          </div>
        )}
      </div>

      {/* 필터 바 */}
      <div className="p-3 sm:p-4 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center gap-3 sm:gap-4">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="학생 이름 또는 번호 검색..." 
            className="pl-9 bg-white border-slate-200 text-xs sm:text-sm h-9 sm:h-10" 
            value={searchTerm} 
            onChange={(e) => setSearchText(e.target.value)} 
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-start w-full md:w-auto">
          {/* 현재 학년 필터 */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
            {[1, 2, 3].map(g => (
              <Button 
                key={g} 
                variant={activeGrade === g ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => handleGradeChange(g)} 
                className={cn("h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-black items-center gap-1", activeGrade === g && "text-indigo-600 bg-indigo-50")}
              >
                {g}학년
                {pendingGrade === g && <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />}
              </Button>
            ))}
          </div>


          {/* 학과 필터 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar max-w-full">
            <Button 
              variant={selectedMajor === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => { setSelectedMajor('all'); setSelectedClass('all'); }} 
              className={cn("h-7 sm:h-8 text-xs font-bold shrink-0", selectedMajor === 'all' && "bg-indigo-600 hover:bg-indigo-700")}
            >
              전체 학과
            </Button>
            {majors.map(major => (
              <Button 
                key={major} 
                variant={selectedMajor === major ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setSelectedMajor(major); setSelectedClass('all'); }} 
                className={cn("h-7 sm:h-8 text-xs font-bold shrink-0", selectedMajor === major && "bg-indigo-600 hover:bg-indigo-700")}
              >
                {major}
              </Button>
            ))}
          </div>

          {/* 반 필터 */}
          {selectedMajor !== 'all' && availableClasses.length > 0 && (
            <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l pt-2 sm:pt-0 sm:pl-3 border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter shrink-0">Class</span>
              <div className="flex items-center gap-1">
                <Button 
                  variant={selectedClass === 'all' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setSelectedClass('all')} 
                  className="h-7 px-2 text-[11px] font-bold shrink-0"
                >
                  전체
                </Button>
                {availableClasses.map(cls => (
                  <Button 
                    key={cls} 
                    variant={selectedClass === cls ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setSelectedClass(cls)} 
                    className="h-7 px-2 text-[11px] font-bold shrink-0"
                  >
                    {cls}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 로딩 시 하단 데이터 영역만 회전 로더 스켈레톤 전환 */}
      {showSkeleton ? (
        <CertificationDataSkeleton />
      ) : (

        <>


      {/* 데스크톱: 테이블 뷰 (md 이상) */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b">
            <tr>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center w-16 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('totalRank')}>석차</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider">학생 정보</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('finalScore')}>환산 점수</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center">이수 과목</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center">성취도 분포 (A-E)</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-right w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedData.map((student) => (
              <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors group cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    {student.totalRank <= 3 && (
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center border shadow-sm mb-0.5", student.totalRank === 1 ? "bg-amber-100 border-amber-200 text-amber-600" : student.totalRank === 2 ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-orange-50 border-orange-100 text-orange-600")}>
                        <Trophy className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <span className={cn("font-black text-xs", student.totalRank <= 3 ? "text-slate-800" : "text-slate-400")}>{student.totalRank}위</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 transition-colors"><User className="h-5 w-5" /></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{student.name} <span className="text-[9px] text-indigo-400 ml-1">({student.currentGrade}학년)</span></span>
                      <span className="text-[10px] text-slate-500 font-medium">{student.major} • {student.classInfo} • {student.number}번</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-base font-black text-indigo-600 leading-none">{student.finalScore}점</span>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-50">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${student.finalScore}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center"><span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">{student.subjectCount}개 과목</span></td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {Object.entries(student.gradeCounts).map(([grade, count]) => (
                      <div key={grade} className="flex flex-col items-center min-w-[24px]">
                        <span className={cn("text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border mb-1", grade === 'A' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : grade === 'B' ? "bg-blue-50 text-blue-600 border-blue-100" : grade === 'C' ? "bg-amber-50 text-amber-600 border-amber-100" : grade === 'D' ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-rose-50 text-rose-600 border-rose-100")}>{grade}</span>
                        <span className="text-[10px] font-bold text-slate-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right"><ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors inline-block" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 목록 뷰 (md 미만) */}
      <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2.5">
        {paginatedData.map((student) => (
          <div 
            key={student.id} 
            className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer hover:border-indigo-200"
            onClick={() => setSelectedStudentId(student.id)}
          >
            {/* 상단: 석차, 학생 정보, 환산 점수 */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  {student.totalRank <= 3 ? (
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex flex-col items-center justify-center border shadow-sm",
                      student.totalRank === 1 ? "bg-amber-100 border-amber-200 text-amber-600" :
                      student.totalRank === 2 ? "bg-slate-100 border-slate-200 text-slate-500" :
                      "bg-orange-50 border-orange-100 text-orange-600"
                    )}>
                      <Trophy className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-xs">
                      {student.totalRank}위
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{student.name}</h3>
                    <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                      {student.currentGrade}학년
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {student.major} • {student.classInfo} • {student.number}번
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm font-black text-indigo-600">{student.finalScore}점</span>
                <span className="text-[10px] text-slate-400 font-bold">{student.subjectCount}개 과목</span>
              </div>
            </div>

            {/* 하단: 성취도 분포 & 화살표 */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 mr-0.5">성취도:</span>
                {Object.entries(student.gradeCounts).map(([grade, count]) => (
                  <div key={grade} className="flex items-center gap-0.5">
                    <span className={cn(
                      "text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border",
                      grade === 'A' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      grade === 'B' ? "bg-blue-50 text-blue-600 border-blue-100" :
                      grade === 'C' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      grade === 'D' ? "bg-orange-50 text-orange-600 border-orange-100" :
                      "bg-rose-50 text-rose-600 border-rose-100"
                    )}>
                      {grade}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 mr-1">{count}</span>
                  </div>
                ))}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </div>
          </div>
        ))}

        {paginatedData.length === 0 && (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-400 font-medium">검색 조건에 해당 학생이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 학생 성적 상세 정보 모달 */}
      <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] w-[95vw] sm:w-full overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mr-6 sm:mr-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <DialogTitle className="text-base sm:text-xl font-black flex items-center gap-2 text-slate-900 truncate">
                    {selectedStudent?.name} 
                    <span className="text-[10px] sm:text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                      {selectedStudent?.number}번
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                    {selectedStudent?.major} • {selectedStudent?.classInfo} • {selectedStudent?.finalScore}점
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-0.5 sm:mb-1">전교 석차</p>
                <p className="text-lg sm:text-2xl font-black text-indigo-600">{selectedStudent?.totalRank}위</p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 custom-scrollbar">
            {isDetailLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="text-sm font-bold text-slate-400">상세 성적을 불러오는 중...</p>
              </div>
            ) : (
              groupedDetails ? groupedDetails.map(([semesterKey, records]) => (
                <div key={semesterKey} className="mb-6 sm:mb-8 last:mb-0 space-y-2 sm:space-y-3">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs sm:text-sm border-l-4 border-indigo-500 pl-2.5 sm:pl-3">
                    {semesterKey} 
                    <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {records.length} 과목
                    </span>
                  </h4>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                    <table className="w-full text-xs text-left min-w-[480px]">
                      <thead className="bg-slate-50/50 text-slate-400 border-b">
                        <tr>
                          <th className="px-3 sm:px-4 py-2.5 font-bold uppercase tracking-wider">과목명</th>
                          <th className="px-3 sm:px-4 py-2.5 font-bold uppercase tracking-wider text-center">학점</th>
                          <th className="px-3 sm:px-4 py-2.5 font-bold uppercase tracking-wider text-center text-indigo-600">원점수</th>
                          <th className="px-3 sm:px-4 py-2.5 font-bold uppercase tracking-wider text-center">과목평균</th>
                          <th className="px-3 sm:px-4 py-2.5 font-bold uppercase tracking-wider text-center">성취도</th>
                          <th className="px-3 sm:px-4 py-2.5 font-bold uppercase tracking-wider text-center">석차등급</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-700">{r.subject}</td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center font-medium text-slate-500">{r.credits || '-'}</td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center font-black text-indigo-600 text-sm">{r.score || '-'}</td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center text-slate-400 font-medium">{r.average_score || '-'}</td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                              <span className={cn("px-2 py-0.5 rounded-full font-black text-[10px]", r.achievement === 'A' ? "bg-emerald-100 text-emerald-700" : r.achievement === 'B' ? "bg-blue-100 text-blue-700" : r.achievement === 'C' ? "bg-amber-100 text-amber-700" : r.achievement === 'D' ? "bg-orange-100 text-orange-700" : r.achievement === 'E' ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500")}>
                                {r.achievement || 'P'}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center font-black text-slate-700">{r.rank_grade ? `${r.rank_grade}등급` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 italic text-xs sm:text-sm">
                  기록된 성적 데이터가 없습니다.
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="p-3 sm:p-4 bg-white border-t flex items-center justify-center gap-1 shrink-0 overflow-x-auto">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
            className="h-8 px-2 text-xs"
          >
            이전
          </Button>
          <div className="flex items-center gap-1 mx-2 sm:mx-4">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <Button 
                  key={pageNum} 
                  variant={currentPage === pageNum ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setCurrentPage(pageNum)} 
                  className={cn("h-7 w-7 sm:h-8 sm:w-8 p-0 font-bold text-xs", currentPage === pageNum && "bg-indigo-600")}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
            className="h-8 px-2 text-xs"
          >
            다음
          </Button>
        </div>
      )}

      {/* 푸터 통계 바 */}
      <div className="p-3 sm:p-4 bg-white border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-bold text-slate-500 shrink-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <span>조회 인원: <span className="text-indigo-600">{filteredData.length}명</span></span>
          <span>전체 평균: <span className="text-indigo-600">{filteredData.length > 0 ? (filteredData.reduce((acc, s) => acc + s.finalScore, 0) / filteredData.length).toFixed(2) : 0}점</span></span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 font-black text-slate-400 hover:text-indigo-600">
          <Download className="h-3 w-3" /> 엑셀 다운로드 (준비중)
        </Button>
      </div>
        </>
      )}
    </div>
  );
}


