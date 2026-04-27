'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { 
  FileUp, 
  AlertCircle, 
  Loader2, 
  User, 
  Trash2,
  Info,
  GraduationCap,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  uploadStudentAttendance, 
  matchStudentsForAttendance, 
  deleteAllStudentAttendance,
  ParsedAttendanceData 
} from './actions';
import { cn } from '@/lib/utils';

export function AttendanceImportClient({ baseYear }: { baseYear: number }) {
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [targetGrade, setTargetGrade] = React.useState<number>(3); 
  const [parsedData, setParsedData] = React.useState<ParsedAttendanceData[]>([]);
  const [studentMatchMap, setStudentMatchMap] = React.useState<Record<string, { id: string; major: string; classInfo: string; gradYear: number }>>({});
  const [fileNames, setFileNames] = React.useState<string[]>([]);
  const { toast } = useToast();

  const handleDeleteAll = async () => {
    if (!confirm('정말로 모든 학생의 출결 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    setIsDeleting(true);
    try {
      const res = await deleteAllStudentAttendance();
      if (res.success) {
        toast({ title: "초기화 완료", description: "출결 데이터가 모두 삭제되었습니다." });
        setParsedData([]);
        setFileNames([]);
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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    const newFileNames = Array.from(files).map(f => f.name);
    setFileNames(prev => Array.from(new Set([...prev, ...newFileNames])));

    const allNewRecords: ParsedAttendanceData[] = [];

    try {
      for (let f = 0; f < files.length; f++) {
        const file = files[f];
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        // 1. 학과/반 정보 검색 (상단 10행 스캔)
        let fileMajor = '';
        let fileClass = '';
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const rowText = (rawRows[i]?.join(' ') || '').replace(/\s+/g, '');
          const classMatch = rowText.match(/([가-힣]+)(\d)학년?-?(\d+)반?/);
          if (classMatch) {
            fileMajor = classMatch[1].trim();
            fileClass = classMatch[3].trim();
            break;
          }
        }

        let currentStudentName = '';
        let currentStudentNumber = '';

        // 2. 데이터 파싱
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length < 4) continue;

          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();
          const col2 = String(row[2] || '').trim(); 
          const col3 = String(row[3] || '').trim(); 

          const isHeaderRow = col0 === '번호' || col1 === '성명' || col2 === '학년' || col2 === '학기' || col0.includes('/') || col1.includes('학년');
          const isCategoryHeader = col3 === '수업일수' || col1 === '소계' || col1 === '합계';
          if (isHeaderRow || isCategoryHeader) continue;

          const hasValidNumber = col0 !== '' && !isNaN(Number(col0));
          if (hasValidNumber) {
            currentStudentNumber = col0;
            if (col1 !== '') {
              currentStudentName = col1.replace(/\s+/g, '');
            }
          }

          const gradeObtained = parseInt(col2);
          const schoolDays = parseInt(col3);

          if (currentStudentName && !isNaN(gradeObtained) && [1, 2, 3].includes(gradeObtained) && !isNaN(schoolDays) && schoolDays > 0) {
            allNewRecords.push({
              studentName: currentStudentName,
              studentNumber: currentStudentNumber,
              gradeObtained,
              semester: 1, 
              schoolDays,
              absentDisease: parseInt(row[4]) || 0,
              absentUnexcused: parseInt(row[5]) || 0,
              absentOther: parseInt(row[6]) || 0,
              lateDisease: parseInt(row[7]) || 0,
              lateUnexcused: parseInt(row[8]) || 0,
              lateOther: parseInt(row[9]) || 0,
              earlyDisease: parseInt(row[10]) || 0,
              earlyUnexcused: parseInt(row[11]) || 0,
              earlyOther: parseInt(row[12]) || 0,
              outDisease: parseInt(row[13]) || 0,
              outUnexcused: parseInt(row[14]) || 0,
              outOther: parseInt(row[15]) || 0,
              remarks: row[16]?.toString() || '',
              major: fileMajor,
              classInfo: fileClass
            });
          }
        }
      }

      // 3. 누적 데이터 업데이트
      const updatedTotalData = [...parsedData, ...allNewRecords];
      
      // 4. 매칭 및 중복 제거
      const uniqueKeys = Array.from(new Set(updatedTotalData.map(s => `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}`)))
        .map(k => {
          const parts = k.split('_');
          return { major: parts[0], classInfo: parts[1], number: parts[2], name: parts[3] };
        });

      const matchResult = await matchStudentsForAttendance(uniqueKeys, baseYear, targetGrade);
      const newMatchMap = matchResult.matchMap || {};
      setStudentMatchMap(newMatchMap);

      const finalData = updatedTotalData.map(s => {
        const key = `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}`;
        return { ...s, studentId: newMatchMap[key]?.id };
      });

      setParsedData(finalData);
      setIsParsing(false);
      toast({ title: "파일 분석 완료", description: `총 ${files.length}개의 파일을 성공적으로 읽어왔습니다.` });
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
      const result = await uploadStudentAttendance(parsedData, baseYear, targetGrade);
      if (result.error) {
        toast({ variant: "destructive", title: "저장 실패", description: result.error });
      } else {
        toast({ title: "저장 완료", description: `${result.count}건의 출결 데이터를 저장했습니다.` });
        setParsedData([]);
        setFileNames([]);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "오류 발생", description: "서버와 통신 중 문제가 발생했습니다." });
    } finally {
      setIsUploading(false);
    }
  };

  const groupedData = React.useMemo(() => {
    const groups: Record<string, { studentName: string; studentNumber: string; major: string; classInfo: string; items: ParsedAttendanceData[] }> = {};
    
    parsedData.forEach(item => {
      const key = `${item.major}_${item.classInfo}_${item.studentNumber}_${item.studentName}`;
      if (!groups[key]) {
        groups[key] = {
          studentName: item.studentName,
          studentNumber: item.studentNumber,
          major: item.major,
          classInfo: item.classInfo,
          items: []
        };
      }
      if (!groups[key].items.find(existing => existing.gradeObtained === item.gradeObtained)) {
        groups[key].items.push(item);
      }
    });

    return Object.entries(groups).map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => {
        if (a.major !== b.major) return a.major.localeCompare(b.major);
        if (a.classInfo !== b.classInfo) return parseInt(a.classInfo) - parseInt(b.classInfo);
        return parseInt(a.studentNumber) - parseInt(b.studentNumber);
      });
  }, [parsedData]);

  return (
    <div className="p-6 space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">출결 데이터 초기화</h3>
          </div>
          <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={isDeleting} className="h-8 text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50">
            {isDeleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
            미리보기 및 DB 초기화
          </Button>
        </div>
        <p className="text-[11px] text-slate-500">시스템에 저장된 모든 학생의 출결 데이터를 영구적으로 삭제하거나 미리보기를 비웁니다.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="h-5 w-5 text-indigo-500" />
          <h3 className="font-bold text-slate-800 text-sm">업로드 대상 학생 현재 학년 설정</h3>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((g) => (
            <Button
              key={g}
              variant={targetGrade === g ? "default" : "outline"}
              onClick={() => { setTargetGrade(g); setParsedData([]); setFileNames([]); }}
              className={cn("flex-1 h-12 font-black text-base", targetGrade === g ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-400")}
            >
              현재 {g}학년
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-10 bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
        <input type="file" id="xlsx-upload-attn" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isParsing || isUploading} multiple />
        <label htmlFor="xlsx-upload-attn" className="flex flex-col items-center cursor-pointer w-full">
          <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-4">
            {isParsing ? <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" /> : <FileUp className="h-8 w-8 text-indigo-500" />}
          </div>
          <span className="text-sm font-semibold text-slate-700">출결 엑셀 파일(들) 선택 (다중 선택 가능)</span>
          <p className="text-[10px] text-slate-400 mt-2 italic">파일을 하나씩 여러 번 올려도 데이터가 누적됩니다.</p>
        </label>
      </div>

      {fileNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileNames.map((name, i) => (
            <div key={i} className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-600">{name}</span>
            </div>
          ))}
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 py-3 border-b">
            <h3 className="font-bold text-slate-800">분석 결과 미리보기 (정제 후: {groupedData.length}명)</h3>
            <Button onClick={handleApply} disabled={isUploading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              DB에 최종 적용하기
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {groupedData.map((group) => {
              const matchKey = `${group.major}_${group.classInfo}_${group.studentNumber}_${group.studentName}`;
              const match = studentMatchMap[matchKey];
              const isMatched = !!match;

              return (
                <div key={group.key} className={cn("bg-white border rounded-xl shadow-sm overflow-hidden", isMatched ? "border-slate-200" : "border-rose-200 bg-rose-50/10")}>
                  <div className={cn("px-4 py-3 border-b flex items-center justify-between", isMatched ? "bg-slate-50" : "bg-rose-50")}>
                    <div className="flex items-center gap-3">
                      <User className={cn("h-4 w-4", isMatched ? "text-slate-400" : "text-rose-400")} />
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-base">{group.studentName}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black">{group.studentNumber}번</span>
                          {isMatched ? (
                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              {match.gradYear}년 졸업예정
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-500 font-bold underline decoration-rose-300">DB 매칭 실패 (정보 불일치)</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {group.major.replace('공업계', '')} • {group.classInfo.replace('반', '')}반
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-[10px] text-center border-collapse min-w-[500px]">
                      <thead className="bg-slate-50/50 text-slate-400 border-b">
                        <tr>
                          <th className="py-2 border-r w-12">대상 학년</th>
                          <th className="py-2 border-r text-rose-600 font-black">미인정(결석/지각/조퇴/결과)</th>
                          <th className="py-2 border-r text-blue-600 font-black">질병(결석/지각/조퇴/결과)</th>
                          <th className="py-2 border-r text-slate-600 font-black">기타(결석/지각/조퇴/결과)</th>
                          <th className="py-2 w-16">수업일수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.sort((a,b) => a.gradeObtained - b.gradeObtained).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 font-bold border-r text-slate-700">{item.gradeObtained}학년</td>
                            <td className="py-2 font-black border-r text-rose-600">
                              {item.absentUnexcused} / {item.lateUnexcused} / {item.earlyUnexcused} / {item.outUnexcused}
                            </td>
                            <td className="py-2 font-bold border-r text-blue-600">
                              {item.absentDisease} / {item.lateDisease} / {item.earlyDisease} / {item.outDisease}
                            </td>
                            <td className="py-2 font-bold border-r text-slate-500">
                              {item.absentOther} / {item.lateOther} / {item.earlyOther} / {item.outOther}
                            </td>
                            <td className="py-2 font-medium text-slate-400">{item.schoolDays}일</td>
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
    </div>
  );
}
