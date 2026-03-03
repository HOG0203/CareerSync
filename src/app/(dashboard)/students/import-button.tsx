'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { FileUp, Download } from 'lucide-react'
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
import { uploadStudentsCSV } from '@/app/students/actions'

export function ImportButton() {
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const { toast } = useToast()

  React.useEffect(() => {
    setMounted(true)
  }, [])

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
      const result = await uploadStudentsCSV(content)
      
      setIsPending(false)
      if (result.error) {
        console.error('업로드 실패:', result.error)
        toast({ 
          variant: "destructive", 
          title: '업로드 실패', 
          description: result.error 
        })
      } else {
        toast({ title: '업로드 성공', description: `${result.count}명의 학생 데이터가 반영되었습니다.` })
        setSelectedFile(null)
        setIsOpen(false)
      }
    }

    reader.readAsText(selectedFile, 'EUC-KR')
  }

  const downloadTemplate = () => {
    const headers = "학번,졸업연도,학과,학반,번호,성명,취업희망유무,취업구분,기업구분,사업구분,회사명,현장실습 실시유무,현장실습 시작일,현장실습 종료일,지원금 신청,채용전환 유무,채용전환일,복교 유무,복교사유,비고"
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + headers], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = "학생관리_일괄업로드_양식.csv"
    link.click()
  }

  // 서버 사이드 렌더링 및 하이드레이션 중에는 기본 버튼만 표시
  if (!mounted) {
    return (
      <Button variant="outline" size="sm">
        <FileUp className="mr-2 h-4 w-4" />
        가져오기
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="mr-2 h-4 w-4" />
          가져오기
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>학생 데이터 일괄 업로드</DialogTitle>
          <DialogDescription>
            엑셀(CSV) 파일을 사용하여 여러 학생의 데이터를 한 번에 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between p-4 border rounded-md bg-muted/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">1. 서식 다운로드</p>
              <p className="text-xs text-muted-foreground">정해진 양식에 맞춰 데이터를 작성해주세요.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={downloadTemplate}>
              <Download className="mr-2 h-3 w-3" />
              서식 받기
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">2. 파일 선택</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isPending}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {selectedFile && (
              <p className="text-xs text-blue-600 font-medium animate-in fade-in slide-in-from-top-1">
                선택된 파일: {selectedFile.name}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => { setIsOpen(false); setSelectedFile(null); }} disabled={isPending}>
            취소
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isPending}
            className="min-w-[100px]"
          >
            {isPending ? '업로드 중...' : '업로드 시작'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
