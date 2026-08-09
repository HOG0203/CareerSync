'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { FileUp, Download, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { bulkPromoteFromExcel } from '@/app/students/actions'

interface PromotionImportButtonProps {
  currentData: any[];
  baseYear: number;
}

export function PromotionImportButton({ currentData, baseYear }: PromotionImportButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsPending(true)
    const reader = new FileReader()
    
    reader.onload = async (event) => {
      const content = event.target?.result as string
      try {
        const result: any = await bulkPromoteFromExcel(content)
        
        if (result.error || result.errors) {
          console.error('업로드 중 일부 오류:', result.errors)
          toast({ 
            variant: "destructive", 
            title: '업로드 완료 (일부 실패)', 
            description: `${result.count}명 성공. ${result.errors?.length || 0}건 실패.` 
          })
        } else {
          toast({ title: '일괄 진급 완료', description: `${result.count}명의 학생 정보가 성공적으로 갱신되었습니다.` })
        }
        setSelectedFile(null)
        setIsOpen(false)
      } catch (err: any) {
        toast({ variant: "destructive", title: '업로드 실패', description: err.message })
      } finally {
        setIsPending(false)
      }
    }

    reader.readAsText(selectedFile, 'EUC-KR')
  }

  const downloadTemplate = () => {
    const headers = ["학번(고유ID)", "성명", "기존 학과", "기존 반", "기존 번호", "진급 후 학과", "진급 후 반", "진급 후 번호"];
    
    // 현재 필터링된 데이터만 내보내기
    const rows = currentData.map(s => [
      s.student_id || '',
      s.student_name || '',
      s.major || '',
      s.class_info || '',
      s.student_number || '',
      '', // 진급 후 학과 (빈칸)
      '', // 진급 후 반 (빈칸)
      ''  // 진급 후 번호 (빈칸)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${baseYear}학년도_진급처리_양식.csv`
    link.click()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
          <ArrowRight className="mr-2 h-4 w-4" />
          엑셀 일괄 진급
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
        <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 mr-6">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
            </div>
            <div className="flex flex-col text-left min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2 text-slate-900 truncate">
                학생 일괄 진급 처리
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                엑셀 데이터 기반 신규 학반 일괄 진급 업로드
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="grid gap-4 p-6">
          <div className="flex items-center justify-between p-4 border rounded-md bg-emerald-50 border-emerald-100">
            <div className="space-y-1">
              <p className="text-sm font-bold text-emerald-800">1. 진급 서식 다운로드</p>
              <p className="text-xs text-emerald-600">현재 화면의 학생 목록이 포함된 서식을 받습니다.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={downloadTemplate} className="bg-white hover:bg-emerald-100 text-emerald-700 border-emerald-200">
              <Download className="mr-2 h-3 w-3" />
              서식 받기
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">2. 파일 선택 및 업로드</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isPending}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"
            />
            {selectedFile && (
              <p className="text-xs text-emerald-600 font-medium animate-in fade-in slide-in-from-top-1">
                선택된 파일: {selectedFile.name}
              </p>
            )}
          </div>
          <div className="bg-slate-50 p-3 rounded-md border border-slate-100 mt-2">
            <ul className="text-[10px] text-slate-500 space-y-1 list-disc pl-4">
              <li><b>주의:</b> A열(학번)은 학생을 식별하는 고유 키이므로 임의로 수정하지 마세요.</li>
              <li>F, G, H열(진급 후 정보)만 정확히 기입하여 업로드해주세요.</li>
              <li>빈칸으로 남겨둔 학생은 진급 처리가 누락되니 주의하세요.</li>
            </ul>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => { setIsOpen(false); setSelectedFile(null); }} disabled={isPending}>
            취소
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isPending}
            className="min-w-[120px] bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? '진급 처리 중...' : '진급 실행하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
