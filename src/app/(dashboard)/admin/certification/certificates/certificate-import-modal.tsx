'use client';

import * as React from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileUp, 
  Settings, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Award,
  Sparkles,
  Trash2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { importUploadedCertificates } from './actions';
import { useRouter } from 'next/navigation';

interface ParsedClassPreview {
  fileName: string;
  major: string;
  grade: number;
  classInfo: string;
  studentCerts: Record<string, string[]>;
  totalStudents: number;
  totalCerts: number;
  rawRows: any[][];
}

function parseNeisCertificates(rawRows: any[][]) {
  let major = '';
  let grade = 0;
  let classInfo = '';
  let classRowIndex = -1;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    
    const classStr = row.find((cell: any) => typeof cell === 'string' && cell.includes('학년')) || '';
    const classMatch = classStr.match(/(?:공업계\s+)?([가-힣]+)\s+(\d)학년?\s+(\d+)반?/);
    if (classMatch) {
      major = classMatch[1].trim();
      grade = parseInt(classMatch[2]);
      classInfo = classMatch[3] + '반';
      classRowIndex = i;
      break;
    }
  }

  if (classRowIndex === -1) {
    throw new Error('학과 및 학년 반 정보를 감지할 수 없습니다. (예: 스마트전기과 3학년 1반)');
  }

  let headerRowIndex = -1;
  for (let i = classRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const hasNumberHeader = row.some((cell: any) => typeof cell === 'string' && cell.replace(/\s+/g, '') === '번호');
    const hasNameHeader = row.some((cell: any) => typeof cell === 'string' && cell.replace(/\s+/g, '') === '성명');
    if (hasNumberHeader || hasNameHeader) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = classRowIndex + 1;
  }

  const studentCerts: Record<string, string[]> = {};
  let currentNum = '';
  let currentName = '';

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const num = row[0];
    const name = row[1];
    const type = row[2]?.toString().trim();
    const certName = row[3]?.toString().trim();

    if (type !== '자격증') continue;

    const hasValidNumber = num !== null && num !== undefined && num !== '' && !isNaN(Number(num));
    if (hasValidNumber) {
      currentNum = num.toString().trim();
      currentName = name ? name.toString().trim() : '';
    }

    if (currentName && certName && certName !== '') {
      if (!studentCerts[currentName]) {
        studentCerts[currentName] = [];
      }
      if (!studentCerts[currentName].includes(certName)) {
        studentCerts[currentName].push(certName);
      }
    }
  }

  return { major, grade, classInfo, studentCerts };
}

export function CertificateImportModal({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [open, setOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previews, setPreviews] = React.useState<ParsedClassPreview[]>([]);
  const [expandedIndices, setExpandedIndices] = React.useState<Record<number, boolean>>({});
  const [importResult, setImportResult] = React.useState<{
    successCount: number;
    skippedCount: number;
    errors: string[] | null;
  } | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (!open) {
      setPreviews([]);
      setExpandedIndices({});
      setImportResult(null);
      setIsProcessing(false);
    }
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setImportResult(null);
    const newPreviews: ParsedClassPreview[] = [];

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      try {
        const fileData = await new Promise<any[][]>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = new Uint8Array(event.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
              resolve(rawRows);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('파일 읽기 실패'));
          reader.readAsArrayBuffer(file);
        });

        const parsed = parseNeisCertificates(fileData);
        const totalStudents = Object.keys(parsed.studentCerts).length;
        const totalCerts = Object.values(parsed.studentCerts).reduce((sum, certs) => sum + certs.length, 0);

        newPreviews.push({
          fileName: file.name,
          major: parsed.major,
          grade: parsed.grade,
          classInfo: parsed.classInfo,
          studentCerts: parsed.studentCerts,
          totalStudents,
          totalCerts,
          rawRows: fileData
        });

      } catch (err: any) {
        toast({
          variant: "destructive",
          title: `${file.name} 분석 실패`,
          description: err.message || "올바른 NEIS 자격증 엑셀 규격이 아닙니다.",
        });
      }
    }

    setPreviews(prev => [...prev, ...newPreviews]);
    setIsProcessing(false);
    e.target.value = '';
  };

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const removePreview = (idxToRemove: number) => {
    setPreviews(prev => prev.filter((_, idx) => idx !== idxToRemove));
    setExpandedIndices(prev => {
      const updated = { ...prev };
      delete updated[idxToRemove];
      return updated;
    });
  };

  const handleApplyImport = async () => {
    if (previews.length === 0) return;
    setIsProcessing(true);
    
    let totalSuccess = 0;
    let totalSkipped = 0;
    let allErrors: string[] = [];

    for (const preview of previews) {
      try {
        const res = await importUploadedCertificates(preview.rawRows);
        if (res.success) {
          totalSuccess += res.successCount || 0;
          totalSkipped += res.skippedCount || 0;
          if (res.errors) {
            allErrors = [...allErrors, ...res.errors];
          }
        } else {
          allErrors.push(`[${preview.fileName}] 업로드 실패: ${res.error}`);
          totalSkipped += preview.totalStudents;
        }
      } catch (e: any) {
        allErrors.push(`[${preview.fileName}] 서버 오류: ${e.message}`);
        totalSkipped += preview.totalStudents;
      }
    }

    setImportResult({
      successCount: totalSuccess,
      skippedCount: totalSkipped,
      errors: allErrors.length > 0 ? allErrors : null
    });

    setPreviews([]);
    setExpandedIndices({});
    setIsProcessing(false);

    toast({
      title: "일괄 반영 완료",
      description: `성공: ${totalSuccess}명, 미매칭/오류: ${totalSkipped}명`,
    });
    router.refresh();
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 sm:gap-2 shadow-lg shadow-indigo-200 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-10 whitespace-nowrap shrink-0">
          <FileUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">자격증 데이터 업로드</span>
          <span className="sm:hidden">자격증 업로드</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden">
        {/* 통일된 상단 헤더 */}
        <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0 flex flex-row items-center justify-start text-left w-full">
          <div className="flex items-center gap-3.5 text-left justify-start">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-sm">
              <Award className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2 text-left">
                <DialogTitle className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight text-left">자격증 현황 일괄 업로드</DialogTitle>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/60 text-xs px-2.5 py-0.5 rounded-md font-bold">NEIS 연동</Badge>
              </div>
              <DialogDescription className="text-slate-500 text-xs sm:text-sm font-medium mt-1 text-left">
                NEIS 자격증 엑셀 파일(.xlsx, .xls)을 가져와 전교생 자격증 현황을 자동 업로드합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 본문 대화상자 내용 */}
        <div className="p-5 sm:p-6 space-y-5 bg-white flex-1 overflow-y-auto custom-scrollbar">
          {/* 통일된 가이드 안내 카테고리 */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs text-slate-700">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h5 className="text-sm sm:text-base font-extrabold text-slate-900">NEIS 자격증 업로드 가이드</h5>
              <div className="text-xs sm:text-sm leading-relaxed text-slate-700 space-y-1 font-medium">
                <p>• <strong className="text-slate-900 font-bold">자격증 파일 다운 방법</strong>: NEIS &gt; 학생부 &gt; 학교생활기록부 &gt; 학생부 항목별 조회 &gt; 학반 선택 &gt; 자격증/인증취득상황 &gt; 자격증/인증취득상황 &gt; <span className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs font-bold text-slate-900 text-xs mx-0.5"><img src="/images/neis-floppy.png" alt="디스켓 아이콘" className="h-4 w-4 object-contain inline" /></span> 클릭 &gt; XLS data 클릭 &gt; 엑셀 파일 다운</p>
                <p>• 엑셀 파일(기계1-3, 전기3-1 등)을 <strong className="text-slate-900 font-bold">드래그앤드롭 또는 복수 선택</strong>하여 한꺼번에 업로드할 수 있습니다.</p>
                <p>• 업로드 즉시 파싱 내역 미리보기가 생성되며, 이상이 없을 때 <strong className="text-slate-900 font-bold">[대기 리스트 전체 DB 반영하기]</strong>를 눌러 반영합니다.</p>
              </div>
            </div>
          </div>

          {/* 통일된 업로드 드롭존 영역 */}
          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center text-indigo-600">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-slate-800">NEIS 자격증 엑셀 파일 선택</h4>
              <p className="text-[11px] text-slate-500 max-w-md">컴퓨터에서 자격증 엑셀 파일(.xlsx, .xls)을 가져옵니다.</p>
            </div>

            <div className="relative pt-1">
              <input 
                type="file" 
                multiple
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden" 
                id="cert-excel-uploader" 
              />
              <label 
                htmlFor="cert-excel-uploader"
                className={`inline-flex items-center gap-2 h-9 px-5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all ${
                  isProcessing
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                }`}
              >
                {isProcessing ? (
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

          {/* 미리보기 대기목록 파트 */}
          {previews.length > 0 && (
            <div className="space-y-3 border border-slate-200 rounded-2xl p-4 bg-slate-50/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">대기 {previews.length}개</Badge>
                  <span className="text-xs font-bold text-slate-800">업로드 파싱 미리보기</span>
                </div>
                <span className="text-[11px] text-slate-400">최종 확인 후 DB 반영 버튼을 클릭하세요.</span>
              </div>

              <div className="space-y-2.5">
                {previews.map((preview, idx) => (
                  <div key={idx} className="border border-slate-200/80 rounded-xl p-3.5 bg-white shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-900">{preview.fileName}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {preview.major} • {preview.grade}학년 {preview.classInfo}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] px-2 py-0.5">
                          학생 {preview.totalStudents}명
                        </Badge>
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-2 py-0.5">
                          자격증 {preview.totalCerts}건
                        </Badge>
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleExpand(idx)}
                          className="h-7 px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-md"
                        >
                          {expandedIndices[idx] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removePreview(idx)}
                          className="h-7 px-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-md"
                        >
                          삭제
                        </Button>
                      </div>
                    </div>

                    {expandedIndices[idx] && (
                      <div className="mt-2 border-t pt-2 text-left space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar bg-slate-50/70 p-3 rounded-xl border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">실제 파싱 내역 상세</p>
                        {Object.entries(preview.studentCerts).map(([studentName, certs]) => (
                          <div key={studentName} className="flex justify-between items-start py-1 border-b border-slate-200/40 last:border-none text-[11px]">
                            <span className="font-bold text-slate-700 w-16 shrink-0">{studentName}</span>
                            <div className="flex flex-wrap gap-1 justify-end max-w-xl">
                              {certs.map((c, i) => (
                                <span key={i} className="bg-white border text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none whitespace-nowrap">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setPreviews([]); setExpandedIndices({}); }}
                  className="font-bold text-xs h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  대기 목록 비우기
                </Button>
                <Button 
                  onClick={handleApplyImport}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-5 rounded-xl text-xs gap-1.5 shadow-md shadow-emerald-100"
                >
                  {isProcessing ? (
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
            </div>
          )}

          {/* 최종 반영 결과 */}
          {importResult && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs animate-in fade-in duration-200">
              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  최종 반영 결과 리포트
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  성공: {importResult.successCount}명 / 보류: {importResult.skippedCount}명
                </span>
              </div>
              <div className="p-4 space-y-3 bg-white">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">성공 반영 학생 수</p>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">{importResult.successCount}명</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">미매칭/보류 학생 수</p>
                    <p className="text-lg font-black text-slate-600 mt-0.5">{importResult.skippedCount}명</p>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-rose-600">상세 보류 내역:</p>
                    <div className="bg-rose-50/30 border border-rose-100 rounded-xl p-3 max-h-[140px] overflow-y-auto text-[10px] text-slate-600 space-y-1 custom-scrollbar">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <div key={i} className="flex gap-1.5 items-start text-left">
                          <span className="text-rose-400 shrink-0 font-bold">•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
