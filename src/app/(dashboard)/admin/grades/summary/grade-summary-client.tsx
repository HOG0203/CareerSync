'use client';

import * as React from 'react';
import { 
  Search, 
  Filter, 
  Trophy, 
  User, 
  ChevronRight,
  TrendingUp,
  Download,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAJOR_SORT_ORDER } from '@/lib/types';

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScoreRecord {
  id: string;
  student_id: string;
  academic_year: number;
  grade: number;
  semester: number;
  subject: string;
  score: number | null;
  average_score: number | null;
  standard_deviation: number | null;
  credits: number | null;
  achievement: string | null;
  rank_grade: string | null;
  students: {
    student_name: string;
    student_number: string;
    major: string;
    class_info: string;
    graduation_year: number;
  };
}

export function GradeSummaryClient({ 
  initialScores, 
  weights,
  allDuplicates = []
}: { 
  initialScores: ScoreRecord[], 
  weights: Record<string, number>,
  allDuplicates?: any[]
}) {
  const [searchTerm, setSearchText] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState('all');
  const [selectedClass, setSelectedClass] = React.useState('all');
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [showDuplicateAnalysis, setShowDuplicateAnalysis] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>({
    key: 'totalRank',
    direction: 'asc'
  });
  
  const maxWeight = Math.max(...Object.values(weights), 0);

  // [핵심] UUID(student_id) 기반 데이터 그룹화
  const processedData = React.useMemo(() => {
    const studentGroups: Record<string, {
      id: string; // UUID
      name: string;
      number: string;
      major: string;
      classInfo: string;
      totalWeightedScore: number;
      maxPossibleScore: number;
      subjectCount: number;
      gradeCounts: Record<string, number>;
      records: ScoreRecord[];
    }> = {};

    initialScores.forEach(record => {
      const sid = record.student_id; // DB 고유 UUID
      if (!sid) return;

      if (!studentGroups[sid]) {
        // 첫 발견 시 해당 학생 정보로 그룹 초기화
        const sInfo = record.students || {};
        studentGroups[sid] = {
          id: sid,
          name: sInfo.student_name || '미상',
          number: sInfo.student_number || '0',
          major: sInfo.major || '미지정',
          classInfo: sInfo.class_info || '미정',
          totalWeightedScore: 0,
          maxPossibleScore: 0,
          subjectCount: 0,
          gradeCounts: { "A": 0, "B": 0, "C": 0, "D": 0, "E": 0 },
          records: []
        };
      }

      // 오직 해당 UUID와 정확히 일치하는 레코드만 추가
      studentGroups[sid].records.push(record);
      studentGroups[sid].subjectCount++;
      
      const credits = record.credits || 0;
      if (record.achievement) {
        const ach = record.achievement.toUpperCase();
        if (weights[ach]) {
          const weight = weights[ach];
          studentGroups[sid].totalWeightedScore += (weight * credits);
        }
        if (studentGroups[sid].gradeCounts[ach] !== undefined) {
          studentGroups[sid].gradeCounts[ach]++;
        }
      }
      studentGroups[sid].maxPossibleScore += (maxWeight * credits);
    });

    const studentsArray = Object.values(studentGroups).map(s => {
      const finalScore = s.maxPossibleScore > 0 
        ? parseFloat(((s.totalWeightedScore / s.maxPossibleScore) * 100).toFixed(2))
        : 0;
      return { ...s, finalScore };
    });

    studentsArray.sort((a, b) => b.finalScore - a.finalScore);
    studentsArray.forEach((s, i) => { (s as any).totalRank = i + 1; });

    let filtered = studentsArray.filter(s => {
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

    return filtered as any[];
  }, [initialScores, weights, searchTerm, selectedMajor, selectedClass, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'desc' };
    });
  };

  const majors = Array.from(new Set(initialScores.map(s => s.students?.major))).filter(Boolean).sort((a, b) => {
    const idxA = MAJOR_SORT_ORDER.indexOf(a);
    const idxB = MAJOR_SORT_ORDER.indexOf(b);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  const availableClasses = React.useMemo(() => {
    if (selectedMajor === 'all') return [];
    const classes = new Set(initialScores.filter(s => s.students?.major === selectedMajor).map(s => s.students?.class_info));
    return Array.from(classes).sort();
  }, [initialScores, selectedMajor]);

  const selectedStudent = React.useMemo(() => 
    selectedStudentId ? processedData.find(s => s.id === selectedStudentId) : null
  , [selectedStudentId, processedData]);

  const groupedDetails = React.useMemo(() => {
    if (!selectedStudent) return null;
    const groups: Record<string, (ScoreRecord & { isDuplicate?: boolean })[]> = {};
    const seen = new Set<string>();
    selectedStudent.records.forEach(r => {
      const semesterKey = `${r.grade}학년 ${r.semester}학기`;
      const duplicateKey = `${r.academic_year}_${r.grade}_${r.semester}_${r.subject}`;
      const recordWithStatus = { ...r, isDuplicate: seen.has(duplicateKey) };
      seen.add(duplicateKey);
      if (!groups[semesterKey]) groups[semesterKey] = [];
      groups[semesterKey].push(recordWithStatus);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [selectedStudent]);

  return (
    <div className="flex flex-col h-full">
      {allDuplicates.length > 0 && (
        <div className="px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-800">데이터 정합성 주의 (중복 발견)</h3>
              <p className="text-xs text-amber-700 mt-1">
                현재 DB에 동일 학생/학기/과목으로 저장된 중복 데이터가 <span className="font-black text-rose-600 underline">{allDuplicates.length}건</span> 있습니다.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowDuplicateAnalysis(!showDuplicateAnalysis)} className="h-7 text-[10px] font-black border-amber-300 text-amber-700 hover:bg-amber-100">
                  {showDuplicateAnalysis ? '분석 패널 닫기' : '중복 내역 전체 분석하기'}
                </Button>
              </div>
              {showDuplicateAnalysis && (
                <div className="mt-4 bg-white rounded-lg border border-amber-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="max-h-[300px] overflow-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b">
                        <tr>
                          <th className="px-3 py-2 font-bold uppercase tracking-tighter">학생 정보</th>
                          <th className="px-3 py-2 font-bold uppercase tracking-tighter text-center">학년/학기</th>
                          <th className="px-3 py-2 font-bold uppercase tracking-tighter">과목명</th>
                          <th className="px-3 py-2 font-bold uppercase tracking-tighter text-center">중복 횟수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allDuplicates.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2">
                              <span className="font-bold text-slate-800">{d.name}</span>
                              <span className="text-slate-400 ml-1">({d.major} {d.classInfo} {d.number}번)</span>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-500">{d.year}년 {d.grade}학년 {d.sem}학기</td>
                            <td className="px-3 py-2 font-bold text-indigo-600">{d.subject}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-black text-[9px]">{d.count}회 반복됨</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-b bg-slate-50/50 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="학생 이름 또는 번호 검색..." className="pl-9 bg-white border-slate-200" value={searchTerm} onChange={(e) => setSearchText(e.target.value)} />
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
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center w-16 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('totalRank')}>석차 {sortConfig?.key === 'totalRank' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider">학생 정보</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('finalScore')}>환산 점수 {sortConfig?.key === 'finalScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('subjectCount')}>이수 과목 {sortConfig?.key === 'subjectCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center">성취도 분포 (A-E)</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-right w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {processedData.map((student) => (
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
                      <span className="font-bold text-slate-900">{student.name}</span>
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
                  <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900">{selectedStudent?.name} <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">{selectedStudent?.number}번</span></DialogTitle>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{selectedStudent?.major} • {selectedStudent?.classInfo} • {selectedStudent?.finalScore}점</p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-1">Overall Rank</p>
                <p className="text-2xl font-black text-indigo-600">{selectedStudent?.totalRank}위</p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50">
            {groupedDetails?.map(([semesterKey, records]) => (
              <div key={semesterKey} className="space-y-3">
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
                        <tr key={i} className={cn("transition-colors", r.isDuplicate ? "bg-rose-50/50 hover:bg-rose-100/50" : "hover:bg-slate-50/50")}>
                          <td className="px-4 py-3 font-bold text-slate-700 flex items-center gap-2">
                            {r.subject} {r.isDuplicate && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500 text-[9px] text-white font-black animate-pulse"><AlertCircle className="h-2 w-2" /> 중복 의심</span>}
                          </td>
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

      <div className="p-4 bg-white border-t flex items-center justify-between text-[11px] font-bold text-slate-500">
        <div className="flex items-center gap-6">
          <span>조회 인원: <span className="text-indigo-600">{processedData.length}명</span></span>
          <span>전체 평균: <span className="text-indigo-600">{processedData.length > 0 ? (processedData.reduce((acc, s) => acc + s.finalScore, 0) / processedData.length).toFixed(2) : 0}점</span></span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 font-black text-slate-400 hover:text-indigo-600"><Download className="h-3 w-3" /> 엑셀 다운로드 (준비중)</Button>
      </div>
    </div>
  );
}
