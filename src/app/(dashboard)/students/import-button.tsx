'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { FileUp, Download, CheckCircle2, FileText, Table, Eye, UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { uploadStudentsCSV, uploadBasicStudentsCSV, previewStudentCSV } from '@/app/students/actions'

interface ImportButtonProps {
  defaultMode?: 'basic' | 'comprehensive';
}

interface PreviewResult {
  totalCount: number;
  newCount: number;
  updateCount: number;
  rows: Array<{
    status: 'new' | 'update';
    graduationYear: number;
    major: string;
    classInfo: string;
    studentNumber: string;
    name: string;
    phone: string;
    middleSchool?: string;
    admissionRank?: number;
  }>;
}

export function ImportButton({ defaultMode = 'comprehensive' }: ImportButtonProps) {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)
  const [isParsing, setIsParsing] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [fileContent, setFileContent] = React.useState<string>('')
  const [preview, setPreview] = React.useState<PreviewResult | null>(null)
  const { toast } = useToast()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      setFileContent('')
      setPreview(null)
      return
    }

    setSelectedFile(file)
    setIsParsing(true)
    setPreview(null)

    try {
      const buffer = await file.arrayBuffer();
      let content = '';
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        content = utf8Decoder.decode(buffer);
      } catch (err) {
        const euckrDecoder = new TextDecoder('euc-kr');
        content = euckrDecoder.decode(buffer);
      }

      setFileContent(content);

      // 미리보기 서버 액션 호출
      const res = await previewStudentCSV(content);
      if (res.success && res.rows) {
        setPreview({
          totalCount: res.totalCount,
          newCount: res.newCount,
          updateCount: res.updateCount,
          rows: res.rows
        });
      } else if (res.error) {
        toast({
          variant: "destructive",
          title: "파일 분석 오류",
          description: res.error
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "파일 읽기 오류",
        description: err.message || "파일을 읽는 중 오류가 발생했습니다."
      });
    } finally {
      setIsParsing(false);
    }
  }

  // UTF-8 및 EUC-KR 인코딩 자동 감지 스마트 업로드
  const handleUpload = async () => {
    if (!selectedFile || !fileContent) return

    setIsPending(true)
    try {
      // 첫 행(헤더)을 읽어 컬럼 수 판별
      const firstLine = fileContent.split(/\r?\n/)[0] || '';
      const columnCount = firstLine.split(',').length;

      let result: any;
      if (columnCount <= 10) {
        // 기본 7개 컬럼 간편 서식
        result = await uploadBasicStudentsCSV(fileContent);
      } else {
        // 30개 종합 서식
        result = await uploadStudentsCSV(fileContent);
      }
      
      if (result.error) {
        toast({ 
          variant: "destructive", 
          title: '업로드 실패', 
          description: result.error 
        });
      } else {
        toast({ 
          title: '업로드 성공', 
          description: `${result.count}명의 학생 데이터가 성공적으로 반영되었습니다.` 
        });
        setSelectedFile(null);
        setFileContent('');
        setPreview(null);
        setIsOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: '파일 처리 오류',
        description: err.message || '파일을 처리하는 중 오류가 발생했습니다.'
      });
    } finally {
      setIsPending(false);
    }
  }

  const resetModal = () => {
    setSelectedFile(null);
    setFileContent('');
    setPreview(null);
  }

  // 1. 취업·실습 종합 서식 다운로드 (31개 컬럼 - 학번 제외)
  const downloadComprehensiveTemplate = () => {
    const headers = "졸업연도,학과,반,번호,성명,휴대전화번호,출신중학교,입학성적(석차백분율%),진로희망,희망 기업유형,희망진로코스,병역희망,취업희망지역,학부모의견,신발사이즈,상의사이즈,비고,취업희망여부,최종진로코스,취업현황,기업구분,회사명,취득자격증,실습처(회사명),현장실습 시작일,현장실습 종료일,지원금 신청,채용전환,채용전환일,복교 유무,복교사유";
    const sampleRow = "\n2027,자동화기계과,1,1,홍길동,010-1234-5678,대구중학교,15.5,대/공기업,공기업,청솔반,현역,대구,학생 의견 존중,270,100,성실함,예,청솔반,채용진행중,대기업,(주)한국정밀,전산응용기계제도기능사; 컴퓨터응용선반기능사,(주)한국정밀,2026-09-01,2026-12-31,O,O,2027-01-01,X,";

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + headers + sampleRow], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = "학생_취업_실습_종합_일괄등록_양식.csv"
    link.click()
  }

  // 2. 학생 기본 명부 서식 다운로드 (8개 간편 컬럼 - 출신중, 입학성적 포함)
  const downloadBasicTemplate = () => {
    const headers = "졸업연도,학과,반,번호,성명,휴대전화번호,출신중학교,입학성적(석차백분율%)";
    const sampleRow = "\n2027,자동화기계과,1,1,홍길동,010-1234-5678,대구중학교,15.5";

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + headers + sampleRow], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = "학생_기본명부_일괄등록_간편양식.csv"
    link.click()
  }


  // SSR 및 하이드레이션 중 기본 버튼
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-xs font-bold">
        <FileUp className="mr-1 sm:mr-1.5 h-3.5 w-3.5" />
        가져오기
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetModal(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl shadow-2xs">
          <FileUp className="mr-1 sm:mr-1.5 h-3.5 w-3.5" />
          가져오기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
        <DialogHeader className="p-5 bg-slate-50/80 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <FileUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                학생 데이터 엑셀(CSV) 일괄 등록
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                CSV 파일을 선택하면 등록 전 신규/기존 데이터 매칭 상태를 미리 확인할 수 있습니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 서식 다운로드 선택 섹션 */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-blue-600" />
              1. 표준 서식 다운로드
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={downloadComprehensiveTemplate}
                className="h-auto py-2.5 px-3 flex flex-col items-start text-left border-blue-200 bg-blue-50/40 hover:bg-blue-50 rounded-xl transition-all"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                  <Table className="h-3.5 w-3.5 text-blue-600" />
                  취업·실습 종합 서식
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  취업, 실습, 출신중, 입학성적 (31개 항목)
                </span>
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                onClick={downloadBasicTemplate}
                className="h-auto py-2.5 px-3 flex flex-col items-start text-left border-slate-200 bg-slate-50/50 hover:bg-slate-100 rounded-xl transition-all"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <FileText className="h-3.5 w-3.5 text-slate-600" />
                  기본 명부 간편 서식
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  성명, 학과, 출신중, 입학성적 (8개 항목)
                </span>
              </Button>
            </div>
          </div>

          {/* 파일 업로드 섹션 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileUp className="h-3.5 w-3.5 text-blue-600" />
              2. 작성된 CSV 파일 선택
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isPending || isParsing}
                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
              {selectedFile && !isParsing && (
                <p className="text-xs text-blue-600 font-bold mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  선택됨: {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          {/* 미리보기 및 매칭 분석 요약 카드 */}
          {isParsing && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              데이터 매칭 미리보기 분석 중...
            </div>
          )}

          {preview && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  3. 데이터 매칭 미리보기
                </p>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 px-2 py-0.5">
                    <UserPlus className="h-3 w-3" />
                    신규 {preview.newCount}건
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 px-2 py-0.5">
                    <UserCheck className="h-3 w-3" />
                    수정 {preview.updateCount}건
                  </Badge>
                  <span className="text-slate-500">(총 {preview.totalCount}건)</span>
                </div>
              </div>

              {/* 미리보기 목록 테이블 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-16 text-center">구분</th>
                      <th className="p-2">성명</th>
                      <th className="p-2">졸업연도</th>
                      <th className="p-2">학과</th>
                      <th className="p-2">반/번호</th>
                      <th className="p-2">출신중</th>
                      <th className="p-2">석차%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 text-center">
                          {row.status === 'new' ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 rounded font-bold">
                              신규
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 rounded font-bold">
                              수정
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 font-bold text-slate-900">{row.name || '-'}</td>
                        <td className="p-2 text-slate-600">{row.graduationYear}년</td>
                        <td className="p-2 text-slate-600">{row.major || '-'}</td>
                        <td className="p-2 text-slate-600">{row.classInfo ? `${row.classInfo}반` : '-'} {row.studentNumber ? `${row.studentNumber}번` : ''}</td>
                        <td className="p-2 text-slate-600">{row.middleSchool || '-'}</td>
                        <td className="p-2 text-slate-600">{row.admissionRank !== undefined && row.admissionRank !== null ? `${row.admissionRank}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex sm:justify-end gap-2 shrink-0">
          <Button 
            variant="outline" 
            onClick={() => { setIsOpen(false); resetModal(); }} 
            disabled={isPending}
            className="h-9 px-4 text-xs font-bold rounded-xl"
          >
            취소
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || !fileContent || isPending || isParsing}
            className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            {isPending ? '등록 진행 중...' : '일괄 등록 시작'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
