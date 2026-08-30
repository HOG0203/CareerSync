'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileUp, 
  AlertCircle, 
  Loader2, 
  User, 
  Trash2,
  Info,
  FileSpreadsheet,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Check
} from 'lucide-react';
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent 
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { 
  uploadStudentScores, 
  matchStudents, 
  deleteAllStudentScores,
  ParsedGradeData 
} from './actions';
import { cn } from '@/lib/utils';

interface SearchableStudentSelectProps {
  gradeStudents: { id: string; name: string; number: string; major: string; classInfo: string; currentGrade: number }[];
  onSelect: (studentId: string) => void;
  suggestedName?: string;
}

function SearchableStudentSelect({ gradeStudents, onSelect, suggestedName }: SearchableStudentSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(suggestedName || '');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 모달/드롭다운 열릴 때 검색어 설정 및 포커스
  React.useEffect(() => {
    if (open) {
      setQuery(suggestedName || '');
      setSelectedMajor('all');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open, suggestedName]);

  // 외부 클릭 시 안전하게 닫기
  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const majors = React.useMemo(() => {
    return Array.from(new Set(gradeStudents.map(s => s.major))).filter(Boolean);
  }, [gradeStudents]);

  const filteredCandidates = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return gradeStudents.filter(cand => {
      if (selectedMajor !== 'all' && cand.major !== selectedMajor) return false;
      if (!q) return true;
      const matchName = cand.name.toLowerCase().includes(q);
      const matchNum = String(cand.number).includes(q);
      const matchClass = cand.classInfo.toLowerCase().includes(q);
      const matchMajor = cand.major.toLowerCase().includes(q);
      return matchName || matchNum || matchClass || matchMajor;
    });
  }, [gradeStudents, query, selectedMajor]);

  return (
    <div className="relative" ref={containerRef}>
      <Button 
        type="button"
        variant="outline" 
        size="sm" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        className={cn(
          "h-7 px-3 text-xs font-bold rounded-lg gap-1.5 shadow-xs transition-all",
          open 
            ? "border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-200" 
            : "border-rose-300 bg-white hover:bg-rose-50 text-rose-700"
        )}
      >
        <Search className="h-3 w-3" />
        <span>DB 학생 검색 매칭</span>
        <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div 
          className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 p-3 bg-white border border-slate-200 shadow-2xl rounded-2xl z-[150] space-y-2.5 text-left"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-600" />
              수동 매칭 학생 검색 ({filteredCandidates.length}명)
            </span>
            <span className="text-[10px] text-slate-400 font-medium">이름, 반, 번호 검색</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="이름 또는 번호 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-6 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center bg-slate-200"
                >
                  ✕
                </button>
              )}
            </div>

            {majors.length > 1 && (
              <select
                value={selectedMajor}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedMajor(e.target.value);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 font-medium focus:outline-none shrink-0 cursor-pointer"
              >
                <option value="all">전체과</option>
                {majors.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/40">
            {filteredCandidates.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                일치하는 학생이 없습니다.
              </div>
            ) : (
              filteredCandidates.map(cand => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(cand.id);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-indigo-50/80 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-indigo-700">
                      {cand.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-white text-slate-600 px-1.5 py-0">
                      {cand.classInfo} {cand.number}번
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium group-hover:text-indigo-600">
                    {cand.major}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GradeImportClient({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<ParsedGradeData[]>([]);
  const [studentMatchMap, setStudentMatchMap] = React.useState<Record<string, { id: string; major: string; classInfo: string }>>({});
  const [detectedFileInfo, setDetectedFileInfo] = React.useState<{ major: string, classInfo: string } | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'matched' | 'unmatched'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [gradeStudents, setGradeStudents] = React.useState<{ id: string; name: string; number: string; major: string; classInfo: string; currentGrade: number }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDeleteAll = async () => {
    if (!confirm('정말로 모든 학생의 성적 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    setIsDeleting(true);
    try {
      const res = await deleteAllStudentScores();
      if (res.success) {
        toast({ title: "초기화 완료", description: "성적 데이터가 모두 삭제되었습니다." });
        setParsedData([]);
        setDetectedFileInfo(null);
      } else {
        toast({ variant: "destructive", title: "삭제 실패", description: res.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "오류 발생", description: "서버 통신 중 오류가 발생했습니다." });
    } finally {
      setIsDeleting(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);
    setParsedData([]);
    setStudentMatchMap({});
    setDetectedFileInfo(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][];

        // 1. 파일 서식 자동 감지 (양식 1: 세로형 NEIS 학생부 교과학습발달상황 vs 양식 2: 가로형 전과목 성적 일람표)
        const allTextSample = rawRows.slice(0, 8).map(r => r.join(' ')).join(' ');
        const isHorizontalSummaryFormat = allTextSample.includes('전과목 성적 일람표') || 
          rawRows.slice(0, 8).some(r => r.includes('반') && r.includes('번호') && (r.includes('성명') || r.includes('이름')) && r.some((c: any) => typeof c === 'string' && /\(\d+\)/.test(c)));

        let rawStudents: ParsedGradeData[] = [];

        if (isHorizontalSummaryFormat) {
          // ==========================================
          // [양식 2] 전과목 성적 일람표 (가로형) 파싱 엔진
          // ==========================================
          let fileYear = 2026;
          let fileSemester = 1;
          let fileGrade = 1;

          for (let i = 0; i < Math.min(5, rawRows.length); i++) {
            const rowStr = rawRows[i].join(' ');
            const yMatch = rowStr.match(/(\d{4})학년도/);
            if (yMatch) fileYear = parseInt(yMatch[1], 10);
            const semMatch = rowStr.match(/제?\s*(\d)\s*학기/);
            if (semMatch) fileSemester = parseInt(semMatch[1], 10);
            const grMatch = rowStr.match(/(\d)\s*학년/);
            if (grMatch) fileGrade = parseInt(grMatch[1], 10);
          }

          // 1) 헤더 행 인덱스 탐색
          let headerRowIdx = -1;
          for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const row = rawRows[i];
            if (row.some((c: any) => String(c).trim() === '반') && 
                row.some((c: any) => String(c).trim() === '번호') && 
                row.some((c: any) => String(c).trim() === '성명' || String(c).trim() === '이름')) {
              headerRowIdx = i;
              break;
            }
          }

          if (headerRowIdx === -1) {
            throw new Error('성적 일람표 서식의 헤더(반, 번호, 성명)를 찾을 수 없습니다.');
          }

          const headerRow = rawRows[headerRowIdx].map(c => String(c).trim());
          const classIdx = headerRow.findIndex(h => h === '반' || h.includes('학급'));
          const numIdx = headerRow.findIndex(h => h === '번호' || h === '번');
          const nameIdx = headerRow.findIndex(h => h === '성명' || h === '이름' || h === '학생명');

          // 2) 과목 컬럼 식별
          interface SubjectCol {
            colIdx: number;
            rawHeader: string;
            subjectName: string;
            credits: number | null;
          }
          const subjectCols: SubjectCol[] = [];

          for (let c = 0; c < headerRow.length; c++) {
            if (c === classIdx || c === numIdx || c === nameIdx) continue;
            const h = headerRow[c];
            if (!h || h === '총점' || h === '평균' || h === '석차' || h === '비고' || h === '순위') continue;

            const match = h.match(/^(.*?)\s*\((\d+)\)$/);
            if (match) {
              subjectCols.push({
                colIdx: c,
                rawHeader: h,
                subjectName: match[1].trim(),
                credits: parseInt(match[2], 10),
              });
            } else {
              subjectCols.push({
                colIdx: c,
                rawHeader: h,
                subjectName: h.trim(),
                credits: null,
              });
            }
          }

          // 3) 학생별 원점수 수집
          interface StudentRawEntry {
            classInfo: string;
            studentNumber: string;
            studentName: string;
            scoresBySubject: Record<string, number>;
          }

          const studentEntries: StudentRawEntry[] = [];
          const subjectScoresMap: Record<string, number[]> = {};
          subjectCols.forEach(sc => { subjectScoresMap[sc.subjectName] = []; });

          for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const rawClass = row[classIdx];
            const rawNum = row[numIdx];
            const rawName = String(row[nameIdx] || '').trim().replace(/\s+/g, '');

            if (!rawName || rawName === '성명' || rawName === '이름' || String(rawClass).includes('총점') || String(rawClass).includes('평균') || isNaN(Number(rawNum))) {
              continue;
            }

            const classNum = String(rawClass).replace(/[^0-9]/g, '');
            const studentNumber = String(rawNum).replace(/[^0-9]/g, '');
            const classInfo = classNum ? `${classNum}반` : '';

            const entry: StudentRawEntry = {
              classInfo,
              studentNumber,
              studentName: rawName,
              scoresBySubject: {}
            };

            subjectCols.forEach(sc => {
              const val = row[sc.colIdx];
              if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
                const numVal = parseFloat(Number(val).toFixed(2));
                entry.scoresBySubject[sc.subjectName] = numVal;
                subjectScoresMap[sc.subjectName].push(numVal);
              }
            });

            studentEntries.push(entry);
          }

          // 4) 과목별 평균/표준편차 및 석차등급(9등급제 vs 5등급제) 산출 매핑 테이블
          const targetGraduationYear = fileYear + (4 - fileGrade);
          const is9Tier = targetGraduationYear === 2027; // 2027학년도 졸업생만 9등급제, 2028년 이후는 5등급제

          interface SubjectStats {
            average: number;
            stdDev: number;
            count: number;
            scoreRankMap: Map<number, string>;
          }

          const subjectStatsMap: Record<string, SubjectStats> = {};

          subjectCols.forEach(sc => {
            const scores = subjectScoresMap[sc.subjectName] || [];
            const N = scores.length;
            if (N === 0) {
              subjectStatsMap[sc.subjectName] = { average: 0, stdDev: 0, count: 0, scoreRankMap: new Map() };
              return;
            }

            const sum = scores.reduce((a, b) => a + b, 0);
            const avg = parseFloat((sum / N).toFixed(1));
            const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / N;
            const stdDev = parseFloat(Math.sqrt(variance).toFixed(1));

            // NEIS 표준 중간석차 및 누적 백분율 공식 적용
            const sortedScores = [...scores].sort((a, b) => b - a);
            const scoreRankMap = new Map<number, string>();
            const uniqueScores = Array.from(new Set(sortedScores));

            uniqueScores.forEach(score => {
              const sameCount = sortedScores.filter(s => s === score).length;
              const firstRank = sortedScores.findIndex(s => s === score) + 1;
              const midRank = firstRank + (sameCount - 1) / 2;
              const cumPct = (midRank / N) * 100;

              let rankGrade = '1';
              if (is9Tier) {
                // 9등급제 (2027 졸업생)
                if (cumPct <= 4) rankGrade = '1';
                else if (cumPct <= 11) rankGrade = '2';
                else if (cumPct <= 23) rankGrade = '3';
                else if (cumPct <= 40) rankGrade = '4';
                else if (cumPct <= 60) rankGrade = '5';
                else if (cumPct <= 77) rankGrade = '6';
                else if (cumPct <= 89) rankGrade = '7';
                else if (cumPct <= 96) rankGrade = '8';
                else rankGrade = '9';
              } else {
                // 5등급제 (2028 이후 졸업생)
                if (cumPct <= 10) rankGrade = '1';
                else if (cumPct <= 34) rankGrade = '2';
                else if (cumPct <= 66) rankGrade = '3';
                else if (cumPct <= 90) rankGrade = '4';
                else rankGrade = '5';
              }

              scoreRankMap.set(score, rankGrade);
            });

            subjectStatsMap[sc.subjectName] = {
              average: avg,
              stdDev,
              count: N,
              scoreRankMap
            };
          });

          // 5) 최종 파싱 레코드 빌드
          studentEntries.forEach(st => {
            subjectCols.forEach(sc => {
              const score = st.scoresBySubject[sc.subjectName];
              if (score === undefined) return;

              // 성취도 산출 (A: >=90, B: >=80, C: >=70, D: >=60, E: <60)
              let achievement = 'E';
              if (score >= 90) achievement = 'A';
              else if (score >= 80) achievement = 'B';
              else if (score >= 70) achievement = 'C';
              else if (score >= 60) achievement = 'D';

              const sStats = subjectStatsMap[sc.subjectName];
              const rankGrade = sStats?.scoreRankMap.get(score) || null;

              rawStudents.push({
                studentName: st.studentName,
                studentNumber: st.studentNumber,
                subject: sc.subjectName,
                score,
                averageScore: sStats ? sStats.average : null,
                standardDeviation: sStats ? sStats.stdDev : null,
                semester: fileSemester,
                gradeObtained: fileGrade,
                credits: sc.credits,
                achievement,
                rankGrade,
                major: '',
                classInfo: st.classInfo,
                currentGrade: fileGrade
              });
            });
          });

          setDetectedFileInfo({
            major: `전과목 성적 일람표 (${is9Tier ? '9등급제' : '5등급제'})`,
            classInfo: `${fileGrade}학년 ${fileSemester}학기 (과목 ${subjectCols.length}개, 총 ${studentEntries.length}명)`
          });

        } else {
          // ==========================================
          // [양식 1] 기존 NEIS 학생부 교과학습발달상황 세로형 파싱 엔진
          // ==========================================
          let fileMajor = '';
          let fileClass = '';
          let fileGrade = 3;

          for (let r = 0; r < 4; r++) {
            const rowText = (rawRows[r] || []).join(' ');
            if (rowText.includes('스마트전기')) fileMajor = '스마트전기과';
            else if (rowText.includes('자동화기계')) fileMajor = '자동화기계과';
            else if (rowText.includes('바이오화학')) fileMajor = '바이오화학과';
            else if (rowText.includes('스마트융합섬유')) fileMajor = '스마트융합섬유과';
            else if (rowText.includes('건설정보')) fileMajor = '건설정보과';
            else if (rowText.includes('컴퓨터전자')) fileMajor = '컴퓨터전자과';
            else if (rowText.includes('기계')) fileMajor = '기계과';
            else if (rowText.includes('전기')) fileMajor = '전기과';

            const classMatch = rowText.match(/(\d)\s*학년\s*(\d)\s*반/);
            if (classMatch) {
              fileGrade = parseInt(classMatch[1]);
              fileClass = `${classMatch[2]}반`;
            }
          }

          setDetectedFileInfo({
            major: fileMajor || '교과학습발달상황',
            classInfo: `${fileGrade}학년 ${fileClass}`
          });

          let currentStudentNumber = '';
          let currentStudentName = '';
          let lastGrade = 3;
          let lastSemester = 1;
          let isCareerElective = false;

          let colSubject = 5;
          let colCredits = 6;
          let colScore = 7;
          let colAchievement = 8;
          let colRankGrade = 10;

          // 헤더 행에서 컬럼 위치 자동 감지
          for (let r = 0; r < Math.min(10, rawRows.length); r++) {
            const row = rawRows[r] || [];
            row.forEach((cell: any, idx: number) => {
              const c = String(cell || '').replace(/\s+/g, '');
              if (c === '과목' || c === '과목명') colSubject = idx;
              else if (c === '학점' || c === '단위' || c === '단위수') colCredits = idx;
              else if (c.includes('원점수') || c.includes('과목평균')) colScore = idx;
              else if (c === '성취도') colAchievement = idx;
              else if (c.includes('석차등급') || c === '석차') colRankGrade = idx;
            });
          }

          for (let i = 4; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const num = row[0];
            const name = row[1];
            const isHeader = num === '번호' || num === '번 호' || name === '성명' || name === '성 명' || (num && isNaN(Number(num)));
            const hasValidNumber = num !== null && num !== undefined && num !== '' && !isNaN(Number(num));

            if (isHeader) {
              // 헤더가 페이지마다 반복되는 경우 컬럼 인덱스 갱신
              row.forEach((cell: any, idx: number) => {
                const c = String(cell || '').replace(/\s+/g, '');
                if (c === '과목' || c === '과목명') colSubject = idx;
                else if (c === '학점' || c === '단위' || c === '단위수') colCredits = idx;
                else if (c.includes('원점수') || c.includes('과목평균')) colScore = idx;
                else if (c === '성취도') colAchievement = idx;
                else if (c.includes('석차등급') || c === '석차') colRankGrade = idx;
              });
              continue;
            }

            if (hasValidNumber) {
              const newNum = num.toString().trim();
              if (newNum !== currentStudentNumber || (name && name.toString().trim() !== "")) {
                currentStudentNumber = newNum;
                currentStudentName = name ? name.toString().trim() : ""; 
                isCareerElective = false;
                lastGrade = 3; 
                lastSemester = 1;
              }
            }

            const rowText = row.join(' ');
            if (rowText.includes('<진로 선택 과목>') || rowText.includes('<진로선택과목>') || rowText.includes('진로 선택')) {
              isCareerElective = true;
              continue;
            }

            if (!currentStudentName && hasValidNumber && name) {
              currentStudentName = name.toString().trim();
            }

            if (currentStudentName && currentStudentNumber) {
              const gradeVal = row[2];
              const semesterVal = row[3];
              if (gradeVal && !isNaN(parseInt(gradeVal))) lastGrade = parseInt(gradeVal);
              if (semesterVal && !isNaN(parseInt(semesterVal))) lastSemester = parseInt(semesterVal);

              const subject = row[colSubject]?.toString().trim();
              const credits = row[colCredits];
              const scoreStr = (row[colScore] || "").toString().trim();
              
              if (subject && subject !== '과목명' && subject !== '과목' && !subject.includes('원점수')) {
                const relaxedScoreRegex = /\s*([\d.]+)\s*\/\s*([\d.]+)(?:\s*\(\s*([\d.]+)\s*\))?/;
                const match = scoreStr.match(relaxedScoreRegex);
                
                let score = null, averageScore = null, standardDeviation = null;
                let achievement = null;
                let finalRankGrade = null;
                const isAchievementInScoreCell = /^[A-E]$|^P$/i.test(scoreStr);

                if (isCareerElective) {
                  achievement = isAchievementInScoreCell ? scoreStr : (row[colAchievement]?.toString().trim() || null);
                  if (match) {
                    score = parseFloat(match[1]);
                    averageScore = parseFloat(match[2]);
                    if (match[3]) standardDeviation = parseFloat(match[3]);
                  }
                } else {
                  achievement = isAchievementInScoreCell ? scoreStr : (row[colAchievement] ? row[colAchievement].toString().trim().split('(')[0] : null);
                  if (match) {
                    score = parseFloat(match[1]);
                    averageScore = parseFloat(match[2]);
                    if (match[3]) standardDeviation = parseFloat(match[3]);
                  }
                  
                  // 석차등급 추출 (colRankGrade 또는 row[10] / row[9]에서 1~9 정수 확인)
                  const rawRank = row[colRankGrade] !== undefined ? row[colRankGrade] : row[10];
                  if (rawRank !== undefined && rawRank !== null) {
                    const rankStr = String(rawRank).trim();
                    if (/^[1-9]$/.test(rankStr)) {
                      finalRankGrade = rankStr;
                    }
                  }
                }

                if (score !== null || achievement !== null) {
                  rawStudents.push({
                    studentName: currentStudentName,
                    studentNumber: currentStudentNumber,
                    subject: subject.trim(),
                    score,
                    averageScore,
                    standardDeviation,
                    semester: lastSemester,
                    gradeObtained: lastGrade,
                    credits: credits && !isNaN(parseInt(credits)) ? parseInt(credits) : null,
                    achievement,
                    rankGrade: finalRankGrade,
                    major: fileMajor,
                    classInfo: fileClass,
                    currentGrade: fileGrade
                  });
                }
              }
            }
          }
        }

        const uniqueKeys = Array.from(new Set(rawStudents.map(s => `${s.major || ''}_${s.classInfo || ''}_${s.studentNumber}_${s.studentName}_${s.currentGrade}`)))
          .map(k => {
            const parts = k.split('_');
            return { major: parts[0], classInfo: parts[1], number: parts[2], name: parts[3], currentGrade: parseInt(parts[4]) };
          });

        const matchResult = await matchStudents(uniqueKeys, 2026);
        const newMatchMap = matchResult.matchMap || {};
        setStudentMatchMap(newMatchMap);
        setGradeStudents(matchResult.gradeStudents || []);

        const finalData = rawStudents.map(s => {
          const key = `${s.major || ''}_${s.classInfo || ''}_${s.studentNumber}_${s.studentName}`;
          const match = newMatchMap[key];
          return {
            ...s,
            studentId: match?.id,
            major: match?.major || s.major || '',
            classInfo: match?.classInfo || s.classInfo || '',
          };
        });

        setParsedData(finalData);
        setIsParsing(false);
        toast({ title: "파일 분석 완료", description: `${finalData.length}개의 성적 레코드를 추출했습니다.` });
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error('Parsing error:', error);
      setIsParsing(false);
      toast({ variant: "destructive", title: "파일 분석 실패", description: error?.message || "엑셀 파일을 읽는 중 오류가 발생했습니다." });
    }
  };

  const handleManualMatch = (classInfo: string, studentNumber: string, studentName: string, selectedStudentId: string) => {
    const targetCandidate = gradeStudents.find(s => s.id === selectedStudentId);
    if (!targetCandidate) return;

    setParsedData(prev => prev.map(item => {
      if (item.classInfo === classInfo && item.studentNumber === studentNumber && item.studentName === studentName) {
        return {
          ...item,
          studentId: targetCandidate.id,
          major: targetCandidate.major || item.major || '',
          classInfo: targetCandidate.classInfo ? (targetCandidate.classInfo.endsWith('반') ? targetCandidate.classInfo : `${targetCandidate.classInfo}반`) : item.classInfo
        };
      }
      return item;
    }));

    toast({
      title: "수동 매칭 적용 완료",
      description: `${studentName}(${studentNumber}번) 학생을 [${targetCandidate.major} ${targetCandidate.classInfo} ${targetCandidate.number}번 ${targetCandidate.name}]과 연결했습니다.`
    });
  };

  const handleApply = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    try {
      const result = await uploadStudentScores(parsedData, 2026);
      if (result.error) {
        toast({ variant: "destructive", title: "저장 실패", description: result.error });
      } else {
        toast({ 
          title: "DB 저장 완료 🎉", 
          description: `성공: ${result.results?.success}건 반영 완료. 다른 엑셀 파일을 이어서 업로드할 수 있습니다.` 
        });
        setParsedData([]);
        setFileName(null);
        setDetectedFileInfo(null);
        setStudentMatchMap({});
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        router.refresh();
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "오류 발생", description: "서버와 통신 중 문제가 발생했습니다." });
    } finally {
      setIsUploading(false);
    }
  };

  const groupedWithScores = React.useMemo(() => {
    const groups: Record<string, { items: ParsedGradeData[], count: number, major: string, classInfo: string, number: number, name: string, studentId?: string }> = {};
    parsedData.forEach(item => {
      const key = `${item.classInfo || ''}_${item.studentNumber}_${item.studentName}`;
      if (!groups[key]) {
        groups[key] = {
          items: [],
          count: 0,
          major: item.major || '',
          classInfo: item.classInfo || '',
          number: parseInt(item.studentNumber) || 0,
          name: item.studentName,
          studentId: item.studentId
        };
      }
      groups[key].items.push(item);
      groups[key].count++;
      if (item.studentId && !groups[key].studentId) groups[key].studentId = item.studentId;
      if (item.major && !groups[key].major) groups[key].major = item.major;
    });

    return Object.values(groups).sort((a, b) => {
      if (a.classInfo !== b.classInfo) return a.classInfo.localeCompare(b.classInfo);
      return a.number - b.number;
    });
  }, [parsedData]);

  const stats = React.useMemo(() => {
    const total = groupedWithScores.length;
    const matched = groupedWithScores.filter(s => !!s.studentId).length;
    const unmatched = total - matched;
    return { total, matched, unmatched };
  }, [groupedWithScores]);

  const filteredGroupedStudents = React.useMemo(() => {
    return groupedWithScores.filter(st => {
      if (filterStatus === 'matched' && !st.studentId) return false;
      if (filterStatus === 'unmatched' && !!st.studentId) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchName = st.name.toLowerCase().includes(term);
        const matchNum = st.number.toString().includes(term);
        const matchClass = st.classInfo.toLowerCase().includes(term);
        const matchMajor = st.major.toLowerCase().includes(term);
        if (!matchName && !matchNum && !matchClass && !matchMajor) return false;
      }
      return true;
    });
  }, [groupedWithScores, filterStatus, searchTerm]);

  return (
    <div className="p-5 sm:p-6 space-y-5">
      {/* 통일된 가이드 안내 카드 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs text-slate-700">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
          <Info className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h5 className="text-sm sm:text-base font-extrabold text-slate-900">NEIS 성적 엑셀 파일 업로드 가이드 (2가지 양식 모두 지원)</h5>
          <div className="text-xs sm:text-sm leading-relaxed text-slate-700 space-y-1 font-medium">
            <p>• <strong className="text-slate-900 font-bold">[양식 1] NEIS 교과학습발달상황 서식</strong>: NEIS &gt; 학생부 &gt; 교과학습발달상황 &gt; XLS data 다운 엑셀</p>
            <p>• <strong className="text-slate-900 font-bold">[양식 2] 전과목 성적 일람표 서식</strong>: NEIS &gt; 성적 &gt; 전과목 성적 일람표 가로형 엑셀 (과목평균, 표준편차, 성취도, 석차등급 5/9등급제 자동 산출)</p>
            <p>• 엑셀 파일을 선택하거나 드래그하여 분석 후 <strong className="text-slate-900 font-bold">[대기 리스트 전체 DB 반영하기]</strong>로 저장합니다.</p>
          </div>
        </div>
      </div>

      {/* 통일된 파일 업로드 드롭존 영역 (클릭 및 드래그 앤 드롭 지원) */}
      <div 
        onClick={() => {
          if (!isParsing && !isUploading) fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDragging) setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (isParsing || isUploading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
        className={cn(
          "border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all text-center flex flex-col items-center justify-center space-y-3 cursor-pointer select-none",
          isDragging 
            ? "border-indigo-500 bg-indigo-50/80 ring-4 ring-indigo-400/20 scale-[1.01]" 
            : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30"
        )}
      >
        <div className={cn(
          "h-12 w-12 rounded-2xl bg-white shadow-sm border flex items-center justify-center transition-transform",
          isDragging ? "text-indigo-600 border-indigo-200 scale-110" : "text-indigo-600 border-slate-200/80"
        )}>
          {isParsing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-6 w-6" />
          )}
        </div>
        <div className="space-y-1 pointer-events-none">
          <h4 className="text-sm font-extrabold text-slate-800">
            {isDragging 
              ? '여기에 파일을 내려놓으세요!' 
              : (fileName || '성적 엑셀 파일을 클릭하거나 드래그하여 업로드')}
          </h4>
          <p className="text-[11px] text-slate-500 max-w-md">
            NEIS 교과학습발달상황 또는 전과목 성적 일람표 엑셀 파일(.xlsx, .xls)을 가져옵니다.
          </p>
        </div>

        <div className="flex items-center justify-center pt-1" onClick={(e) => e.stopPropagation()}>
          <input 
            ref={fileInputRef}
            type="file" 
            id="xlsx-upload-grade" 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }} 
            disabled={isParsing || isUploading} 
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || isUploading}
            className={`inline-flex items-center gap-2 h-9 px-5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all ${
              isParsing || isUploading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
            }`}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                파일 분석 및 성적/석차 산출 중...
              </>
            ) : (
              <>
                <FileUp className="h-3.5 w-3.5" />
                컴퓨터에서 파일 찾기
              </>
            )}
          </button>
        </div>
      </div>

      {detectedFileInfo && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center gap-2.5">
          <Info className="h-4 w-4 text-indigo-600 shrink-0" />
          <p className="text-xs text-indigo-800 font-bold">
            파일 감지 정보: <span className="underline decoration-indigo-300 underline-offset-2">{detectedFileInfo.major} {detectedFileInfo.classInfo}</span> 데이터를 추출했습니다.
          </p>
        </div>
      )}

      {/* 미리보기 리스트 */}
      {parsedData.length > 0 && (
        <div className="space-y-4 border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/40">
          {/* 상단 통계 요약 & DB 반영 버튼 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>성적 데이터 미리보기</span>
                <Badge variant="outline" className="text-slate-600 bg-white font-bold text-xs">총 {stats.total}명 ({parsedData.length}건)</Badge>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                매칭 성공된 학생은 저장 시 DB에 즉시 반영되며, 매칭 실패 학생은 건너뜁니다.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={handleApply} 
                disabled={isUploading || stats.matched === 0} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-5 rounded-xl text-xs gap-1.5 shadow-md shadow-emerald-100"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    DB 반영 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    매칭된 {stats.matched}명 DB 일괄 저장하기
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 필터 탭 & 검색 바 */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div className="flex items-center bg-slate-200/70 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  filterStatus === 'all' 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                전체 ({stats.total}명)
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('matched')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  filterStatus === 'matched' 
                    ? "bg-white text-emerald-700 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                매칭 성공 ({stats.matched}명)
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('unmatched')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  filterStatus === 'unmatched' 
                    ? "bg-white text-rose-700 shadow-xs" 
                    : stats.unmatched > 0 
                      ? "text-rose-600 font-extrabold" 
                      : "text-slate-600 hover:text-slate-900"
                )}
              >
                <AlertTriangle className={cn("h-3.5 w-3.5", stats.unmatched > 0 ? "text-rose-600" : "text-slate-400")} />
                매칭 실패 ({stats.unmatched}명)
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="이름, 학급, 번호 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* 학생 카드 목록 */}
          <div className="space-y-3">
            {filteredGroupedStudents.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-medium">선택된 필터 조건에 해당하는 학생이 없습니다.</p>
              </div>
            ) : (
              filteredGroupedStudents.map((student) => {
                const isMatched = !!student.studentId;

                return (
                  <div 
                    key={`${student.classInfo}_${student.number}_${student.name}`} 
                    className={cn(
                      "bg-white border rounded-xl shadow-xs overflow-hidden transition-all",
                      isMatched ? "border-slate-200" : "border-rose-300 ring-1 ring-rose-200"
                    )}
                  >
                    {/* 카드 헤더 */}
                    <div className={cn(
                      "px-3.5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2",
                      isMatched ? "bg-slate-50/80" : "bg-rose-50/80"
                    )}>
                      <div className="flex items-center gap-2.5">
                        <User className={cn("h-4 w-4", isMatched ? "text-slate-400" : "text-rose-500")} />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">{student.name}</span>
                          <Badge variant="outline" className="bg-white text-slate-600 text-[10px] px-1.5 py-0">
                            {student.classInfo} {student.number}번
                          </Badge>
                          {isMatched ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-2 py-0 font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              DB 매칭: {student.major} • {student.classInfo}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] px-2 py-0 font-bold flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              DB 미매칭 (신규/학적 확인 필요)
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{student.items.length}개 과목</span>
                    </div>

                    {/* 매칭 실패 시 수동 매칭 연결 안내 바 */}
                    {!isMatched && (
                      <div className="px-3.5 py-2 bg-rose-50/40 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>DB에 일치하는 학적이 없습니다. 직접 학생을 검색하여 연결하시겠습니까?</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <SearchableStudentSelect 
                            gradeStudents={gradeStudents}
                            suggestedName={student.name}
                            onSelect={(selectedId) => {
                              handleManualMatch(student.classInfo, String(student.number), student.name, selectedId);
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 과목 테이블 */}
                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-slate-50/50 text-slate-500 border-b">
                          <tr>
                            <th className="px-3.5 py-1.5 font-bold">학년/학기</th>
                            <th className="px-3.5 py-1.5 font-bold">과목명</th>
                            <th className="px-3.5 py-1.5 font-bold text-center">학점</th>
                            <th className="px-3.5 py-1.5 font-bold text-center text-indigo-600">원점수</th>
                            <th className="px-3.5 py-1.5 font-bold text-center">과목평균(표준편차)</th>
                            <th className="px-3.5 py-1.5 font-bold text-center">성취도</th>
                            <th className="px-3.5 py-1.5 font-bold text-center">석차등급</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {student.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3.5 py-1.5 text-slate-500">{item.gradeObtained}학년 {item.semester}학기</td>
                              <td className="px-3.5 py-1.5 font-semibold text-slate-800">{item.subject}</td>
                              <td className="px-3.5 py-1.5 text-center text-slate-600">{item.credits ?? '-'}</td>
                              <td className="px-3.5 py-1.5 text-center font-bold text-indigo-600">{item.score ?? '-'}</td>
                              <td className="px-3.5 py-1.5 text-center text-slate-500">
                                {item.averageScore !== null ? `${item.averageScore}${item.standardDeviation !== null ? ` (${item.standardDeviation})` : ''}` : '-'}
                              </td>
                              <td className="px-3.5 py-1.5 text-center">
                                <span className={cn("px-2 py-0.5 rounded-md font-bold text-[10px]", 
                                  item.achievement === 'A' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                                  item.achievement === 'B' ? "bg-blue-50 text-blue-600 border border-blue-100" : 
                                  item.achievement === 'C' ? "bg-amber-50 text-amber-600 border border-amber-100" : 
                                  item.achievement === 'D' ? "bg-orange-50 text-orange-600 border border-orange-100" : 
                                  item.achievement === 'E' ? "bg-rose-50 text-rose-600 border border-rose-100" : 
                                  "bg-slate-100 text-slate-500")}>
                                  {item.achievement}
                                </span>
                              </td>
                              <td className="px-3.5 py-1.5 text-center font-extrabold text-slate-700">{item.rankGrade ? `${item.rankGrade}등급` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {parsedData.length === 0 && !isParsing && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-300">
          <AlertCircle className="h-8 w-8 mb-1.5 opacity-20" />
          <p className="text-xs text-slate-400">분석된 성적 데이터가 없습니다. 엑셀 파일을 선택하세요.</p>
        </div>
      )}
    </div>
  );
}
