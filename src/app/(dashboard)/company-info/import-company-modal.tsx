'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  FileText,
  X 
} from 'lucide-react';
import { bulkUpsertCompanies, CompanyData } from './actions';

interface ImportCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportCompanyModal({ isOpen, onClose, onSuccess }: ImportCompanyModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [parsedData, setParsedData] = React.useState<CompanyData[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const { toast } = useToast();

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setIsParsing(false);
    setIsUploading(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // 템플릿 다운로드 기능
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        '업체명': '(주)한국반도체 (샘플)',
        '소재지': '인천광역시 중구 운서동',
        '업종': '반도체 후공정',
        '기업구분': '중견기업',
        '채용직무': '반도체 생산/설비 관리',
        '급여(연봉)': '3,600만원',
        '상여금': '별도 200%',
        '근무시간': '4조 3교대 (06:00~14:00 / 14:00~22:00 / 22:00~06:00)',
        '고용형태': '정규직',
        '복리후생': '기숙사 제공, 통근버스, 식사제공, 건강검진, 장기근속포상',
        '추천학과': '자동화기계과, 스마트전기과',
        '자격요건': '교대근무 가능자, 방진복 착용 가능자',
        '기업강점': '코스닥 상장사, 기숙사 무료 제공 및 주거 지원',
        '비고': '면접 시 교통비 지급'
      },
      {
        '업체명': '(주)미래모빌리티 (샘플)',
        '소재지': '경상북도 구미시 공단동',
        '업종': '자동차 부품 제조',
        '기업구분': '강소기업',
        '채용직무': '품질관리 / CAD 설계',
        '급여(연봉)': '3,400만원',
        '상여금': '연 100%',
        '근무시간': '주 5일 (08:30~17:30)',
        '고용형태': '정규직',
        '복리후생': '4대보험, 자녀학자금, 경조사비, 체력단련비',
        '추천학과': '친환경자동차과, 자동화기계과',
        '자격요건': '컴퓨터응용가공기능사 자격증 소지자 우대',
        '기업강점': '유연근무제 시행, 성과급 별도 지급',
        '비고': '채용전환형 현장실습 가능'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // 컬럼 너비 설정
    worksheet['!cols'] = [
      { wch: 22 }, // 업체명
      { wch: 25 }, // 소재지
      { wch: 18 }, // 업종
      { wch: 12 }, // 기업구분
      { wch: 22 }, // 채용직무
      { wch: 15 }, // 급여
      { wch: 12 }, // 상여금
      { wch: 30 }, // 근무시간
      { wch: 12 }, // 고용형태
      { wch: 35 }, // 복리후생
      { wch: 25 }, // 추천학과
      { wch: 25 }, // 자격요건
      { wch: 30 }, // 기업강점
      { wch: 20 }, // 비고
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '업체정보_등록양식');

    XLSX.writeFile(workbook, '업체정보_일괄등록_양식.xlsx');
    
    toast({
      title: "양식 파일 다운로드 완료",
      description: "다운로드된 엑셀 양식 작성 후 파일을 업로드해 주세요.",
    });
  };

  // 엑셀 파싱
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        const companies: CompanyData[] = jsonData.map((row) => {
          // 컬럼명 유연 처리 (한글 필드명 매핑)
          const name = String(row['업체명'] || row['기업명'] || row['회사명'] || row['업체'] || row['name'] || '').trim();
          const location = String(row['소재지'] || row['주소'] || row['위치'] || row['location'] || '').trim();
          const industry = String(row['업종'] || row['업종/직무'] || row['industry'] || '').trim();
          const company_type = String(row['기업구분'] || row['기업분류'] || row['company_type'] || '').trim();
          const job_description = String(row['채용직무'] || row['담당업무'] || row['job_description'] || '').trim();
          const salary = String(row['급여(연봉)'] || row['급여'] || row['연봉'] || row['salary'] || '').trim();
          const bonus = String(row['상여금'] || row['bonus'] || '').trim();
          const working_hours = String(row['근무시간'] || row['working_hours'] || '').trim();
          const employment_type = String(row['고용형태'] || row['employment_type'] || '').trim();
          const welfare = String(row['복리후생'] || row['복지'] || row['welfare'] || '').trim();
          const required_major = String(row['추천학과'] || row['대상학과'] || row['required_major'] || '').trim();
          const required_certificates = String(row['자격요건'] || row['자격증'] || row['required_certificates'] || '').trim();
          const strengths = String(row['기업강점'] || row['강점'] || row['strengths'] || '').trim();
          const etc = String(row['비고'] || row['기타'] || row['etc'] || '').trim();

          return {
            name,
            location: location || undefined,
            industry: industry || undefined,
            company_type: company_type || undefined,
            job_description: job_description || undefined,
            salary: salary || undefined,
            bonus: bonus || undefined,
            working_hours: working_hours || undefined,
            employment_type: employment_type || undefined,
            welfare: welfare || undefined,
            required_major: required_major || undefined,
            required_certificates: required_certificates || undefined,
            strengths: strengths || undefined,
            etc: etc || undefined,
          };
        }).filter(c => c.name.length > 0); // 업체명 유효성 필터

        setParsedData(companies);
        setIsParsing(false);
      } catch (error) {
        console.error('File parsing error:', error);
        toast({
          title: "파일 읽기 실패",
          description: "엑셀 파일 형식이 올바르지 않습니다.",
          variant: "destructive",
        });
        setIsParsing(false);
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  // 일괄 등록 실행
  const handleSubmit = async () => {
    if (parsedData.length === 0) {
      toast({
        title: "등록할 데이터 없음",
        description: "올바른 업체 정보가 포함된 엑셀 파일을 업로드해 주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const res = await bulkUpsertCompanies(parsedData);
      if (res.error) {
        toast({
          title: "일괄 등록 실패",
          description: res.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "일괄 등록 완료 🎉",
          description: `총 ${res.count}개 업체 정보가 성공적으로 등록/업데이트되었습니다.`,
        });
        onSuccess();
        handleClose();
      }
    } catch (err: any) {
      toast({
        title: "오류 발생",
        description: err.message || "서버 통신 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            업체 정보 엑셀 일괄 등록
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            엑셀 파일(.xlsx)을 업로드하여 여러 업체 정보를 한 번에 신규 등록하거나 업데이트할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Step 1: 템플릿 다운로드 */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">1. 등록 양식 다운로드</h4>
                <p className="text-xs text-slate-500">표준 양식 엑셀 파일에 업체 정보를 작성 후 업로드하세요.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="bg-white hover:bg-emerald-50 hover:text-emerald-700 border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-1.5 shrink-0"
            >
              <Download className="h-4 w-4" />
              양식 다운로드 (.xlsx)
            </Button>
          </div>

          {/* Step 2: 파일 업로드 영역 */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-800 px-1">2. 엑셀 파일 업로드 (.xlsx, .xls)</h4>
            {!file ? (
              <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-8 text-center transition-all bg-slate-50/50 hover:bg-emerald-50/30 group cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-white border border-slate-200 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">클릭하거나 엑셀 파일을 여기에 끌어다 놓으세요</p>
                  <p className="text-xs text-slate-400">지원 형식: .xlsx, .xls, .csv</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                    <p className="text-[11px] font-medium text-emerald-700">
                      {isParsing ? '파일 파싱 중...' : `정상 파싱됨 (총 ${parsedData.length}개 업체)`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  disabled={isUploading}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white/60 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Step 3: 미리보기 테이블 */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  업로드 데이터 미리보기 ({parsedData.length}건)
                </h4>
                <span className="text-xs text-slate-500 font-medium">동일한 업체명이 존재할 경우 기존 데이터가 갱신됩니다.</span>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-[260px] overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 font-bold text-slate-700 border-b">
                    <tr>
                      <th className="p-2.5 pl-3">NO</th>
                      <th className="p-2.5">업체명</th>
                      <th className="p-2.5">소재지</th>
                      <th className="p-2.5">업종</th>
                      <th className="p-2.5">기업구분</th>
                      <th className="p-2.5">급여(연봉)</th>
                      <th className="p-2.5 pr-3">추천학과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white text-slate-600">
                    {parsedData.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 pl-3 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                        <td className="p-2 font-bold text-slate-900">{c.name}</td>
                        <td className="p-2 truncate max-w-[150px]">{c.location || '-'}</td>
                        <td className="p-2 truncate max-w-[100px]">{c.industry || '-'}</td>
                        <td className="p-2 font-semibold text-emerald-700">{c.company_type || '-'}</td>
                        <td className="p-2 font-medium">{c.salary || '-'}</td>
                        <td className="p-2 pr-3 truncate max-w-[120px]">{c.required_major || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 shrink-0 flex items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isUploading}
            className="text-xs font-bold"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={parsedData.length === 0 || isParsing || isUploading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 flex items-center gap-1.5 shadow-md"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                등록 처리 중...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {parsedData.length > 0 ? `${parsedData.length}개 업체 일괄 등록 실행` : '일괄 등록 실행'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
