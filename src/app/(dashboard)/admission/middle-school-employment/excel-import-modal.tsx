'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  UploadCloud, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  School,
  X
} from 'lucide-react';
import { batchUpdateAdmissionFromExcelAction, ExcelAdmissionRow } from './actions';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetGraduationYear?: number;
  students?: any[];
}

export function ExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
  targetGraduationYear,
  students,
}: ExcelImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [parsedRows, setParsedRows] = React.useState<ExcelAdmissionRow[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 학생 명단이 사전 포함된 템플릿 다운로드 (.xlsx)
  const handleDownloadTemplate = () => {
    const headerRow = ['졸업년도', '학번', '성명', '학과', '반', '출신중학교', '입학석차백분율(%)', '전형구분'];
    
    let studentRows: (string | number)[][] = [];
    if (students && students.length > 0) {
      studentRows = students.map((s) => [
        s.graduation_year ? `${s.graduation_year}년` : '',
        s.student_number || '',
        s.student_name || '',
        s.major || '',
        s.class_info ? `${s.class_info}반` : '',
        s.middle_school || '',
        s.admission_rank_percentile !== undefined && s.admission_rank_percentile !== null ? s.admission_rank_percentile : '',
        s.admission_type || ''
      ]);
    } else {
      studentRows = [
        ['2027년', '30101', '홍길동', '스마트기계과', '1반', '옥천중학교', 14.5, '일반전형'],
        ['2027년', '30202', '이순신', '스마트전기과', '2반', '옥천여자중학교', 8.2, '특별전형'],
        ['2027년', '30303', '강감찬', '바이오화학과', '3반', '이원중학교', 25.0, '일반전형']
      ];
    }

    const data = [headerRow, ...studentRows];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 8 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = students && students.length > 0 ? '전교생_입학정보_일괄작성' : '입학정보양식';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileName = students && students.length > 0
      ? `CareerSync_전교생명단포함_입학성적_출신중학교_서식.xlsx`
      : 'CareerSync_입학성적_출신중학교_일괄등록서식.xlsx';

    XLSX.writeFile(wb, fileName);
  };

  // 파일 파싱 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      let wb: XLSX.WorkBook;
      
      if (file.name.endsWith('.csv')) {
        let content = '';
        try {
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          content = utf8Decoder.decode(buffer);
        } catch {
          const euckrDecoder = new TextDecoder('euc-kr');
          content = euckrDecoder.decode(buffer);
        }
        wb = XLSX.read(content, { type: 'string' });
      } else {
        wb = XLSX.read(buffer, { type: 'array' });
      }

      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];

      const rawData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (!rawData || rawData.length < 2) {
        toast({
          variant: 'destructive',
          title: '파일 파싱 실패',
          description: '엑셀 파일에 유효한 데이터가 없습니다.',
        });
        setIsParsing(false);
        return;
      }

      const headers: string[] = (rawData[0] || []).map((h: any) => String(h || '').trim());
      
      // 유연한 헤더 매핑 인덱스 탐색
      const numIdx = headers.findIndex(h => h.includes('학번') || h.includes('번호'));
      const nameIdx = headers.findIndex(h => h.includes('성명') || h.includes('이름') || h.includes('학생명'));
      const majorIdx = headers.findIndex(h => h.includes('학과') || h.includes('전공'));
      const schoolIdx = headers.findIndex(h => h.includes('중학교') || h.includes('출신교') || h.includes('출신중'));
      const rankIdx = headers.findIndex(h => h.includes('백분율') || h.includes('석차') || h.includes('내신%'));
      const typeIdx = headers.findIndex(h => h.includes('전형') || h.includes('구분'));

      if (nameIdx === -1 && schoolIdx === -1) {
        toast({
          variant: 'destructive',
          title: '컬럼 인식 실패',
          description: '최소한 [성명]과 [출신중학교] 컬럼이 포함되어 있어야 합니다.',
        });
        setIsParsing(false);
        return;
      }

      const rows: ExcelAdmissionRow[] = [];
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
        if (!name) continue;

        const studentNumber = numIdx !== -1 ? String(row[numIdx] || '').trim() : undefined;
        const major = majorIdx !== -1 ? String(row[majorIdx] || '').trim() : undefined;
        const middleSchool = schoolIdx !== -1 ? String(row[schoolIdx] || '').trim() : undefined;
        
        let admissionRankPercentile: number | null = null;
        if (rankIdx !== -1 && row[rankIdx] !== undefined && row[rankIdx] !== '') {
          const val = parseFloat(String(row[rankIdx]).replace(/[^0-9.]/g, ''));
          if (!isNaN(val)) admissionRankPercentile = val;
        }

        const admissionType = typeIdx !== -1 ? String(row[typeIdx] || '').trim() : undefined;

        rows.push({
          studentNumber,
          studentName: name,
          major,
          middleSchool,
          admissionRankPercentile,
          admissionType,
        });
      }

      setParsedRows(rows);
      toast({
        title: '엑셀 파싱 완료',
        description: `총 ${rows.length}명의 입학 및 출신교 데이터를 읽어왔습니다.`,
      });
    } catch (err: any) {
      console.error('Failed to parse excel:', err);
      toast({
        variant: 'destructive',
        title: '파싱 오류',
        description: '엑셀 파일을 읽는 중 오류가 발생했습니다. 서식을 확인해 주세요.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // DB에 일괄 저장
  const handleApply = async () => {
    if (parsedRows.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await batchUpdateAdmissionFromExcelAction(parsedRows, targetGraduationYear);
      if (res.success) {
        toast({
          title: '일괄 등록 성공',
          description: `성공적으로 ${res.matchedCount}명의 출신중학교 및 입학성적 정보를 반영했습니다. (미매칭: ${res.skippedCount}건)`,
        });
        onSuccess();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: '일괄 등록 실패',
          description: res.error || '저장 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err?.message || '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
        <DialogHeader className="p-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mr-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                <School className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  출신 중학교 및 입학성적 엑셀 일괄 등록
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  엑셀(Excel/CSV) 파일 업로드로 여러 학생의 출신 중학교와 입학 전형 성적을 한 번에 업데이트합니다.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          {/* 1단계: 템플릿 다운로드 및 파일 업로드 영역 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 서식 다운로드 카드 */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">1. 학생 명단 포함 서식 다운로드</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {students && students.length > 0
                    ? `전교생(${students.length}명)의 학번·성명·학과가 미리 기재된 서식입니다.`
                    : '학번, 성명, 학과, 출신중학교, 입학성적이 포함된 표준 서식입니다.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="w-full text-xs font-bold border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-800"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                {students && students.length > 0 ? '학생 명단 포함 서식 받기' : '표준 엑셀 서식 받기'}
              </Button>
            </div>

            {/* 파일 선택 카드 */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">2. 작성된 엑셀 업로드</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  작성된 엑셀(.xlsx) 또는 CSV 파일을 선택하세요.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="w-full text-xs font-bold bg-blue-50/50 hover:bg-blue-50 border-blue-200 text-blue-700"
                >
                  {isParsing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {selectedFile ? selectedFile.name : '파일 선택하기'}
                </Button>
              </div>
            </div>
          </div>

          {/* 2단계: 파싱 데이터 미리보기 */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-2 p-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    미리보기: 총 <span className="text-blue-600">{parsedRows.length}</span>명
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-7 text-[11px] text-slate-400 hover:text-rose-600"
                >
                  <X className="h-3 w-3 mr-1" /> 목록 비우기
                </Button>
              </div>

              <div className="max-h-[220px] overflow-y-auto border rounded-lg border-slate-100">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="py-2 text-[11px] font-bold">학번</TableHead>
                      <TableHead className="py-2 text-[11px] font-bold">성명</TableHead>
                      <TableHead className="py-2 text-[11px] font-bold">학과</TableHead>
                      <TableHead className="py-2 text-[11px] font-bold">출신중학교</TableHead>
                      <TableHead className="py-2 text-[11px] font-bold text-right">석차백분율</TableHead>
                      <TableHead className="py-2 text-[11px] font-bold">전형구분</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/70">
                        <TableCell className="py-1.5 font-mono text-[11px] text-slate-500">
                          {row.studentNumber || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 font-bold text-slate-800">
                          {row.studentName}
                        </TableCell>
                        <TableCell className="py-1.5 text-slate-600 text-[11px]">
                          {row.major || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-slate-800 font-medium">
                          {row.middleSchool || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-slate-700">
                          {row.admissionRankPercentile !== null ? `${row.admissionRankPercentile}%` : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-slate-500 text-[11px]">
                          {row.admissionType || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-[10.5px] text-slate-400 text-center py-1">
                  * 미리보기는 상위 50명만 표시되며, 저장 시 전체 {parsedRows.length}명이 반영됩니다.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-white border-t border-slate-100 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-bold border-slate-200"
          >
            닫기
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={parsedRows.length === 0 || isSubmitting}
            className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm px-5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                {parsedRows.length > 0 ? `${parsedRows.length}명 일괄 저장` : '일괄 저장'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
