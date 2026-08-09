'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
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
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  uploadStudentScores, 
  matchStudents, 
  deleteAllStudentScores,
  ParsedGradeData 
} from './actions';
import { cn } from '@/lib/utils';

export function GradeImportClient() {
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<ParsedGradeData[]>([]);
  const [studentMatchMap, setStudentMatchMap] = React.useState<Record<string, { id: string; major: string; classInfo: string }>>({});
  const [detectedFileInfo, setDetectedFileInfo] = React.useState<{ major: string, classInfo: string } | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
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
        let fileGrade = 3;
        const headerRowText = rawRows[2]?.join(' ') || '';
        const classMatch = headerRowText.match(/([가-힣]+)\s*(\d)학년?\s*-?\s*(\d+)반?/);
        
        if (classMatch) {
          fileMajor = classMatch[1].trim();
          fileClass = classMatch[3].trim() + '반';
          fileGrade = parseInt(classMatch[2]) || 3;
          setDetectedFileInfo({ major: fileMajor, classInfo: fileClass });
        } else {
          const gradeMatch = headerRowText.match(/(\d)학년/);
          if (gradeMatch) {
            fileGrade = parseInt(gradeMatch[1]) || 3;
          }
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

          if (hasValidNumber && !isHeader) {
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
          if (rowText.includes('<진로 선택 과목>')) {
            isCareerElective = true;
            continue;
          }

          if (!currentStudentName && !isHeader && hasValidNumber && name) {
            currentStudentName = name.toString().trim();
          }

          if (currentStudentName && currentStudentNumber && !isHeader) {
            const gradeVal = row[2];
            const semesterVal = row[3];
            if (gradeVal && !isNaN(parseInt(gradeVal))) lastGrade = parseInt(gradeVal);
            if (semesterVal && !isNaN(parseInt(semesterVal))) lastSemester = parseInt(semesterVal);

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
                classInfo: fileClass,
                currentGrade: fileGrade
              });
            }
          }
        }

        const uniqueKeys = Array.from(new Set(rawStudents.map(s => `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}_${s.currentGrade}`)))
          .map(k => {
            const parts = k.split('_');
            return { major: parts[0], classInfo: parts[1], number: parts[2], name: parts[3], currentGrade: parseInt(parts[4]) };
          });

        const matchResult = await matchStudents(uniqueKeys, 2026);
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
      const result = await uploadStudentScores(parsedData, 2026);
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
    const groups: Record<string, { items: ParsedGradeData[], count: number }> = {};
    parsedData.forEach(item => {
      const key = `${item.major}_${item.classInfo}_${item.studentNumber}_${item.studentName}`;
      if (!groups[key]) groups[key] = { items: [], count: 0 };
      groups[key].items.push(item);
      groups[key].count++;
    });

    return Object.entries(groups).map(([key, data]) => {
      const parts = key.split('_');
      return { key, number: parseInt(parts[2]) || 0, ...data };
    }).sort((a, b) => a.number - b.number);
  }, [parsedData]);

  return (
    <div className="p-5 sm:p-6 space-y-5">
      {/* 통일된 가이드 안내 카드 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs text-slate-700">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
          <Info className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h5 className="text-sm sm:text-base font-extrabold text-slate-900">NEIS 성적 엑셀 파일 업로드 가이드</h5>
          <div className="text-xs sm:text-sm leading-relaxed text-slate-700 space-y-1 font-medium">
            <p>• <strong className="text-slate-900 font-bold">성적 파일 다운 방법</strong>: NEIS &gt; 학생부 &gt; 학교생활기록부 &gt; 학생부 항목별 조회 &gt; 학반 선택 &gt; 교과학습발달상황 &gt; 교과학습발달상황 &gt; <span className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs font-bold text-slate-900 text-xs mx-0.5"><img src="/images/neis-floppy.png" alt="디스켓 아이콘" className="h-4 w-4 object-contain inline" /></span> 클릭 &gt; XLS data 클릭 &gt; 엑셀 파일 다운</p>
            <p>• 엑셀 파일(기계1-3, 전기3-1 등)을 선택하여 학생들의 학기별/과목별 성적을 업로드합니다.</p>
            <p>• 파싱 내역 미리보기 확인 후 <strong className="text-slate-900 font-bold">[대기 리스트 전체 DB 반영하기]</strong>를 클릭하여 반영합니다.</p>
          </div>
        </div>
      </div>

      {/* 통일된 파일 업로드 드롭존 영역 */}
      <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center text-indigo-600">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-extrabold text-slate-800">{fileName || 'NEIS 성적 엑셀 파일 선택'}</h4>
          <p className="text-[11px] text-slate-500 max-w-md">컴퓨터에서 성적 엑셀 파일(.xlsx, .xls)을 가져옵니다.</p>
        </div>

        <div className="flex items-center justify-center pt-1">
          <input 
            type="file" 
            id="xlsx-upload-grade" 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
            disabled={isParsing || isUploading} 
          />
          <label 
            htmlFor="xlsx-upload-grade" 
            className={`inline-flex items-center gap-2 h-9 px-5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all ${
              isParsing || isUploading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
            }`}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                파일 분석 중...
              </>
            ) : (
              <>
                <FileUp className="h-3.5 w-3.5" />
                엑셀 파일 선택하기
              </>
            )}
          </label>
        </div>
      </div>

      {detectedFileInfo && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center gap-2.5">
          <Info className="h-4 w-4 text-indigo-600 shrink-0" />
          <p className="text-xs text-indigo-800 font-bold">
            파일 감지 정보: <span className="underline decoration-indigo-300 underline-offset-2">{detectedFileInfo.major} {detectedFileInfo.classInfo}</span> 데이터를 수집했습니다.
          </p>
        </div>
      )}

      {/* 미리보기 리스트 */}
      {parsedData.length > 0 && (
        <div className="space-y-3 border border-slate-200 rounded-2xl p-4 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">학생 {groupedWithScores.length}명 감지</Badge>
              <span className="text-xs font-bold text-slate-800">성적 미리보기 (과목 {parsedData.length}건)</span>
            </div>
            <Button 
              onClick={handleApply} 
              disabled={isUploading} 
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
                  대기 리스트 전체 DB 반영하기
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {groupedWithScores.map((student) => {
              const [, , number, name] = student.key.split('_');
              const match = studentMatchMap[student.key];
              const isMatched = !!match;

              return (
                <div key={student.key} className={cn("bg-white border rounded-xl shadow-xs overflow-hidden", isMatched ? "border-slate-200" : "border-rose-200 bg-rose-50/10")}>
                  <div className={cn("px-3.5 py-2.5 border-b flex items-center justify-between", isMatched ? "bg-slate-50/80" : "bg-rose-50/60")}>
                    <div className="flex items-center gap-2.5">
                      <User className={cn("h-4 w-4", isMatched ? "text-slate-400" : "text-rose-400")} />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{name}</span>
                        <Badge variant="outline" className="bg-white text-slate-600 text-[10px] px-1.5 py-0">{number}번</Badge>
                        {isMatched ? (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-2 py-0">
                            {match.major} • {match.classInfo}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] px-2 py-0">
                            DB 매칭 실패
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{student.items.length}개 과목</span>
                  </div>

                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-50/50 text-slate-500 border-b">
                        <tr>
                          <th className="px-3.5 py-1.5 font-bold">학년/학기</th>
                          <th className="px-3.5 py-1.5 font-bold">과목명</th>
                          <th className="px-3.5 py-1.5 font-bold text-center">학점</th>
                          <th className="px-3.5 py-1.5 font-bold text-center text-indigo-600">원점수</th>
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
                            <td className="px-3.5 py-1.5 text-center">
                              <span className={cn("px-2 py-0.5 rounded-md font-bold text-[10px]", item.achievement === 'A' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : item.achievement === 'B' ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-slate-100 text-slate-500")}>
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
            })}
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
