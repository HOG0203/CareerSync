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

export function GradeSummaryClient({ 
  initialSummaries, 
  weights
}: { 
  initialSummaries: StudentSummary[], 
  weights: Record<string, number>
}) {
  const [searchTerm, setSearchText] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState('all');
  const [selectedClass, setSelectedClass] = React.useState('all');
  const [selectedGrade, setSelectedGrade] = React.useState<number>(3); 
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [detailedScores, setDetailedScores] = React.useState<any[]>([]);
  const [isDetailLoading, setIsDetailedLoading] = React.useState(false);
  const PAGE_SIZE = 50;

  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>({
    key: 'totalRank',
    direction: 'asc'
  });

  // [속도 최적화] 필터링 연산
  const filteredData = React.useMemo(() => {
    let filtered = initialSummaries.filter(s => {
      const matchGrade = s.currentGrade === selectedGrade;
      const matchMajor = selectedMajor === 'all' || s.major === selectedMajor;
      const matchClass = selectedClass === 'all' || s.classInfo === selectedClass;
      const matchSearch = s.name.includes(searchTerm) || s.number.includes(searchTerm);
      return matchGrade && matchMajor && matchClass && matchSearch;
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
  }, [initialSummaries, searchTerm, selectedMajor, selectedClass, selectedGrade, sortConfig]);

  // 상세 성적을 모달 열릴 때만 가져옴 (On-demand)
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

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMajor, selectedClass, selectedGrade, sortConfig]);

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
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 flex justify-end">
        <GradeImportModal />
      </div>

      <div className="p-4 border-b bg-slate-50/50 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="학생 이름 또는 번호 검색..." className="pl-9 bg-white border-slate-200" value={searchTerm} onChange={(e) => setSearchText(e.target.value)} />
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {[1, 2, 3].map(g => (
            <Button key={g} variant={selectedGrade === g ? 'secondary' : 'ghost'} size="sm" onClick={() => setSelectedGrade(g)} className={cn("h-8 px-3 text-xs font-black", selectedGrade === g && "text-indigo-600 bg-indigo-50")}>{g}학년</Button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <Button variant={selectedMajor === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedMajor('all'); setSelectedClass('all'); }} className={cn("h-8 text-xs font-bold shrink-0", selectedMajor === 'all' && "bg-indigo-600 hover:bg-indigo-700")}>
            전체 학과
          </Button>
          {majors.map(major => (
            <Button key={major} variant={selectedMajor === major ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedMajor(major); setSelectedClass('all'); }} className={cn("h-8 text-xs font-bold shrink-0", selectedMajor === major && "bg-indigo-600 hover:bg-indigo-700")}>
              {major}
            </Button>
          ))}
        </div>
        {selectedMajor !== 'all' && availableClasses.length > 0 && (
          <div className="flex items-center gap-2 border-l pl-4 border-slate-200 ml-auto sm:ml-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">Class</span>
            <div className="flex items-center gap-1">
              <Button variant={selectedClass === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSelectedClass('all')} className="h-7 px-2 text-[11px] font-bold">전체</Button>
              {availableClasses.map(cls => (
                <Button key={cls} variant={selectedClass === cls ? 'secondary' : 'ghost'} size="sm" onClick={() => setSelectedClass(cls)} className="h-7 px-2 text-[11px] font-bold">{cls}</Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
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

      <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b border-slate-100">
            <div className="flex items-center justify-between mr-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center"><User className="h-6 w-6 text-slate-400" /></div>
                <div className="flex flex-col text-left">
                  <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
                    {selectedStudent?.name} <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">{selectedStudent?.number}번</span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                    {selectedStudent?.major} • {selectedStudent?.classInfo} • {selectedStudent?.finalScore}점
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-1">Overall Rank</p>
                <p className="text-2xl font-black text-indigo-600">{selectedStudent?.totalRank}위</p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {isDetailLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="text-sm font-bold text-slate-400">상세 성적을 불러오는 중...</p>
              </div>
            ) : groupedDetails?.map(([semesterKey, records]) => (
              <div key={semesterKey} className="mb-8 last:mb-0 space-y-3">
                <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm border-l-4 border-indigo-500 pl-3">{semesterKey} <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">{records.length} Subjects</span></h4>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/50 text-slate-400 border-b">
                      <tr>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider">과목명</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-center">학점</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-center text-indigo-600">원점수</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-center">과목평균</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-center">성취도</th>
                        <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-center">석차등급</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-700">{r.subject}</td>
                          <td className="px-4 py-3 text-center font-medium text-slate-500">{r.credits || '-'}</td>
                          <td className="px-4 py-3 text-center font-black text-indigo-600 text-sm">{r.score || '-'}</td>
                          <td className="px-4 py-3 text-center text-slate-400 font-medium">{r.average_score || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("px-2.5 py-1 rounded-full font-black text-[10px]", r.achievement === 'A' ? "bg-emerald-100 text-emerald-700" : r.achievement === 'B' ? "bg-blue-100 text-blue-700" : r.achievement === 'C' ? "bg-amber-100 text-amber-700" : r.achievement === 'D' ? "bg-orange-100 text-orange-700" : r.achievement === 'E' ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500")}>
                              {r.achievement || 'P'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black text-slate-700">{r.rank_grade ? `${r.rank_grade}등급` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="p-4 bg-white border-t flex items-center justify-center gap-1 shrink-0">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="h-8 px-2">이전</Button>
          <div className="flex items-center gap-1 mx-4">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (<Button key={pageNum} variant={currentPage === pageNum ? "default" : "ghost"} size="sm" onClick={() => setCurrentPage(pageNum)} className={cn("h-8 w-8 p-0 font-bold text-xs", currentPage === pageNum && "bg-indigo-600")}>{pageNum}</Button>);
            })}
          </div>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="h-8 px-2">다음</Button>
        </div>
      )}

      <div className="p-4 bg-white border-t flex items-center justify-between text-[11px] font-bold text-slate-500">
        <div className="flex items-center gap-6">
          <span>조회 인원: <span className="text-indigo-600">{filteredData.length}명</span></span>
          <span>전체 평균: <span className="text-indigo-600">{filteredData.length > 0 ? (filteredData.reduce((acc, s) => acc + s.finalScore, 0) / filteredData.length).toFixed(2) : 0}점</span></span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 font-black text-slate-400 hover:text-indigo-600"><Download className="h-3 w-3" /> 엑셀 다운로드 (준비중)</Button>
      </div>
    </div>
  );
}
