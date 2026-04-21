'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { 
  FileUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  User, 
  Settings2, 
  Trophy, 
  Trash2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  uploadStudentScores, 
  matchStudents, 
  getAchievementScores, 
  updateAchievementScores,
  deleteAllStudentScores,
  ParsedGradeData 
} from './actions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export function GradeImportClient() {
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<ParsedGradeData[]>([]);
  const [studentMatchMap, setStudentMatchMap] = React.useState<Record<string, { id: string; major: string; classInfo: string }>>({});
  const [detectedFileInfo, setDetectedFileInfo] = React.useState<{ major: string, classInfo: string } | null>(null);
  const [achievementWeights, setAchievementWeights] = React.useState<Record<string, number>>({
    "A": 5, "B": 4, "C": 3, "D": 2, "E": 1
  });
  const [fileName, setFileName] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    async function loadWeights() {
      const weights = await getAchievementScores();
      setAchievementWeights(weights);
    }
    loadWeights();
  }, []);

  const handleWeightChange = (grade: string, val: string) => {
    const num = parseInt(val) || 0;
    setAchievementWeights(prev => ({ ...prev, [grade]: num }));
  };

  const saveWeights = async () => {
    const res = await updateAchievementScores(achievementWeights);
    if (res.success) {
      toast({ title: "설정 저장 완료", description: "성취도별 점수 가중치가 저장되었습니다." });
    }
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        let fileMajor = '';
        let fileClass = '';
        const headerRowText = rawRows[2]?.join(' ') || '';
        const classMatch = headerRowText.match(/([가-힣]+)\s*(\d)학년?\s*-?\s*(\d+)반?/);
        
        if (classMatch) {
          fileMajor = classMatch[1].trim();
          fileClass = classMatch[3].trim() + '반';
          setDetectedFileInfo({ major: fileMajor, classInfo: fileClass });
        }

        const rawStudents: any[] = [];
        let currentStudentName = '';
        let currentStudentNumber = '';
        let lastGrade = 3;
        let lastSemester = 1;
        let isCareerElective = false;

        for (let i = 4; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const num = row[0];
          const name = row[1];
          const isHeader = num === '번호' || name === '성명' || (num && isNaN(Number(num)));
          const hasValidNumber = num !== null && num !== undefined && num !== '' && !isNaN(Number(num));

          // [핵심 수정] 새로운 번호가 감지되면 즉시 학생 컨텍스트 교체
          if (hasValidNumber && !isHeader) {
            const newNum = num.toString().trim();
            // 번호가 바뀌었거나, 이름이 새로 제공된 경우
            if (newNum !== currentStudentNumber || (name && name.toString().trim() !== "")) {
              currentStudentNumber = newNum;
              // 이름이 없으면 일단 비워두어 이전 학생 데이터가 섞이는 것을 원천 차단
              currentStudentName = name ? name.toString().trim() : ""; 
              isCareerElective = false;
              lastGrade = 3; 
              lastSemester = 1;
            }
          }

          const rowText = row.join(' ');
          if (rowText.includes('<진로 선택 과목>')) {
            isCareerElective = true;
            continue;
          }

          // 이름 정보가 아직 없는 경우(첫 행 파싱 등) 다음 행에서 찾기 위해 대기
          if (!currentStudentName && !isHeader && hasValidNumber && name) {
            currentStudentName = name.toString().trim();
          }

          if (currentStudentName && currentStudentNumber && !isHeader) {
            const gradeVal = row[2];
            const semesterVal = row[3];
            if (gradeVal && !isNaN(parseInt(gradeVal))) lastGrade = parseInt(gradeVal);
            if (semesterVal && !isNaN(parseInt(semesterVal))) lastSemester = parseInt(semesterVal);

            const curriculum = row[4]?.toString().trim();
            const subject = row[5]?.toString().trim();
            const credits = row[6];
            const scoreStr = (row[7] || "").toString().trim();
            
            if (subject && subject !== '과목명' && subject !== '과목' && subject !== '원점수/과목평균(표준편차)') {
              const relaxedScoreRegex = /\s*([\d.]+)\s*\/\s*([\d.]+)(?:\s*\(\s*([\d.]+)\s*\))?/;
              const match = scoreStr.match(relaxedScoreRegex);
              
              let score = null, averageScore = null, standardDeviation = null;
              let achievement = null;
              let finalRankGrade = null;
              const isAchievementInScoreCell = /^[A-E]$|^P$/i.test(scoreStr);

              if (isCareerElective) {
                achievement = isAchievementInScoreCell ? scoreStr : (row[10]?.toString().trim() || null);
                if (match) {
                  score = parseFloat(match[1]);
                  averageScore = parseFloat(match[2]);
                  if (match[3]) standardDeviation = parseFloat(match[3]);
                } else if (!isAchievementInScoreCell) {
                  const s = row[7]?.toString().trim();
                  const a = row[8]?.toString().trim();
                  const d = row[9]?.toString().trim();
                  if (s && !isNaN(Number(s))) score = Number(s);
                  if (a && !isNaN(Number(a))) averageScore = Number(a);
                  if (d) {
                    const dMatch = d.match(/[\d.]+/);
                    if (dMatch) standardDeviation = Number(dMatch[0]);
                  }
                }
              } else {
                achievement = isAchievementInScoreCell ? scoreStr : (row[8] ? row[8].toString().trim().split('(')[0] : null);
                if (match) {
                  score = parseFloat(match[1]);
                  averageScore = parseFloat(match[2]);
                  if (match[3]) standardDeviation = parseFloat(match[3]);
                }
                const col9 = row[9]?.toString().trim();
                finalRankGrade = (col9 && !isNaN(Number(col9))) ? col9 : null;
              }

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
                classInfo: fileClass
              });
            }
          }
        }

        // DB 매칭 정보 가져오기
        const uniqueKeys = Array.from(new Set(rawStudents.map(s => `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}`)))
          .map(k => {
            const parts = k.split('_');
            return { major: parts[0], classInfo: parts[1], number: parts[2], name: parts[3] };
          });

        const matchResult = await matchStudents(uniqueKeys, 2026, 3);
        const newMatchMap = matchResult.matchMap || {};
        setStudentMatchMap(newMatchMap);

        const finalData = rawStudents.map(s => {
          const key = `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}`;
          return { ...s, studentId: newMatchMap[key]?.id };
        });

        setParsedData(finalData);
        setIsParsing(false);
        toast({ title: "파일 분석 완료", description: `${finalData.length}개의 성적 레코드를 추출했습니다.` });
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Parsing error:', error);
      setIsParsing(false);
      toast({ variant: "destructive", title: "파일 분석 실패", description: "엑셀 파일을 읽는 중 오류가 발생했습니다." });
    }
  };

  const handleApply = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    try {
      const result = await uploadStudentScores(parsedData, 2026, 3);
      if (result.error) {
        toast({ variant: "destructive", title: "저장 실패", description: result.error });
      } else {
        toast({ title: "저장 완료", description: `성공: ${result.results?.success}, 실패: ${result.results?.failed}` });
        setParsedData([]);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "오류 발생", description: "서버와 통신 중 문제가 발생했습니다." });
    } finally {
      setIsUploading(false);
    }
  };

  const groupedWithScores = React.useMemo(() => {
    const groups: Record<string, { items: ParsedGradeData[], totalScore: number, maxPossibleScore: number, finalScore: number }> = {};
    const maxWeight = Math.max(...Object.values(achievementWeights), 0);

    parsedData.forEach(item => {
      const key = `${item.major}_${item.classInfo}_${item.studentNumber}_${item.studentName}`;
      if (!groups[key]) groups[key] = { items: [], totalScore: 0, maxPossibleScore: 0, finalScore: 0 };

      groups[key].items.push(item);
      const credits = item.credits || 0;
      if (item.achievement && achievementWeights[item.achievement.toUpperCase()]) {
        const weight = achievementWeights[item.achievement.toUpperCase()];
        groups[key].totalScore += (weight * credits);
      }
      groups[key].maxPossibleScore += (maxWeight * credits);
    });

    const studentsArray = Object.entries(groups).map(([key, data]) => {
      const parts = key.split('_');
      const number = parseInt(parts[2]) || 0;
      const ratioScore = data.maxPossibleScore > 0 ? (data.totalScore / data.maxPossibleScore) * 100 : 0;
      return { key, number, ...data, finalScore: parseFloat(ratioScore.toFixed(2)) };
    });

    studentsArray.sort((a, b) => b.finalScore - a.finalScore);
    studentsArray.forEach((student, index) => { (student as any).rank = index + 1; });
    studentsArray.sort((a, b) => a.number - b.number);

    return studentsArray as unknown as { key: string; items: ParsedGradeData[]; totalScore: number; maxPossibleScore: number; finalScore: number; rank: number }[];
  }, [parsedData, achievementWeights]);

  return (
    <div className="p-6 space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">성취도별 점수 가중치 설정</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={isDeleting} className="h-8 text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50">
              {isDeleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
              데이터 전체 초기화
            </Button>
            <Button variant="outline" size="sm" onClick={saveWeights} className="h-8 text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              설정 저장
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {['A', 'B', 'C', 'D', 'E'].map(grade => (
            <div key={grade} className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 ml-1 uppercase">{grade}등급 점수</label>
              <Input type="number" value={achievementWeights[grade] || 0} onChange={(e) => handleWeightChange(grade, e.target.value)} className="h-9 font-bold text-center" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-10 bg-slate-50/50 hover:bg-slate-50 transition-colors">
        <input type="file" id="xlsx-upload" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isParsing || isUploading} />
        <label htmlFor="xlsx-upload" className="flex flex-col items-center cursor-pointer">
          <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-4">
            {isParsing ? <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" /> : <FileUp className="h-8 w-8 text-indigo-500" />}
          </div>
          <span className="text-sm font-semibold text-slate-700">{fileName || '성적 엑셀 파일(xlsx) 선택'}</span>
        </label>
      </div>

      {detectedFileInfo && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
          <Info className="h-4 w-4 text-indigo-500" />
          <p className="text-xs text-indigo-700 font-bold">
            파일 감지 정보: <span className="underline decoration-indigo-300 underline-offset-2">{detectedFileInfo.major} {detectedFileInfo.classInfo}</span> 데이터를 처리합니다.
          </p>
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 py-3 border-b">
            <h3 className="font-bold text-slate-800">분석 결과 미리보기 (총 {groupedWithScores.length}명)</h3>
            <Button onClick={handleApply} disabled={isUploading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              DB에 최종 적용하기
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {groupedWithScores.map((student) => {
              const [major, classInfo, number, name] = student.key.split('_');
              const match = studentMatchMap[student.key];
              const isMatched = !!match;

              return (
                <div key={student.key} className={cn("bg-white border rounded-xl shadow-sm overflow-hidden", isMatched ? "border-slate-200" : "border-rose-200 bg-rose-50/10")}>
                  <div className={cn("px-4 py-3 border-b flex items-center justify-between", isMatched ? "bg-slate-50" : "bg-rose-50")}>
                    <div className="flex items-center gap-4">
                      <User className={cn("h-5 w-5", isMatched ? "text-slate-400" : "text-rose-400")} />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-base">{name}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-black">{number}번</span>
                          <span className={cn("text-xs font-black", student.rank === 1 ? "text-amber-500" : "text-indigo-600")}>
                            {student.rank}위 ({student.finalScore}점 / 100)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isMatched ? <span className="text-[10px] text-slate-500 font-bold">{match.major} • {match.classInfo}</span> : <span className="text-[10px] text-rose-500 font-bold text-[9px]">DB 매칭 실패 (ID 미확보)</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{student.items.length} Subjects</span>
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/50 text-slate-500 border-b">
                      <tr>
                        <th className="px-4 py-2 font-medium">학년/학기</th>
                        <th className="px-4 py-2 font-medium">과목명</th>
                        <th className="px-4 py-2 font-medium text-center">학점</th>
                        <th className="px-4 py-2 font-medium text-center text-indigo-600">원점수</th>
                        <th className="px-4 py-2 font-medium text-center">과목평균</th>
                        <th className="px-4 py-2 font-medium text-center">성취도</th>
                        <th className="px-4 py-2 font-medium text-center">석차등급</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {student.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-4 py-2 text-slate-500">{item.gradeObtained}학년 {item.semester}학기</td>
                          <td className="px-4 py-2 font-semibold text-slate-800">{item.subject}</td>
                          <td className="px-4 py-2 text-center text-slate-600 font-medium">{item.credits ?? '-'}</td>
                          <td className="px-4 py-2 text-center font-bold text-indigo-600">{item.score ?? '-'}</td>
                          <td className="px-4 py-2 text-center text-slate-500">{item.averageScore ?? '-'}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={cn("px-2 py-0.5 rounded-full font-bold", item.achievement === 'A' ? "bg-emerald-50 text-emerald-600" : item.achievement === 'B' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500")}>
                              {item.achievement}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center font-black text-slate-700">{item.rankGrade ? `${item.rankGrade}등급` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {parsedData.length === 0 && !isParsing && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">분석된 데이터가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
