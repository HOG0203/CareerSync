'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Save, Loader2 } from 'lucide-react'
import { createStudent } from '@/app/students/actions'
import { useToast } from '@/hooks/use-toast'

interface AddStudentModalProps {
  isOpen: boolean
  onClose: () => void
  baseYear: number
  majors: string[]
}

export function AddStudentModal({ isOpen, onClose, baseYear, majors }: AddStudentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = React.useState({
    student_name: '',
    major: '',
    class_info: '',
    student_number: '',
    graduation_year: (baseYear + 1).toString()
  })

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        student_name: '',
        major: majors[0] || '',
        class_info: '',
        student_number: '',
        graduation_year: (baseYear + 1).toString()
      })
    }
  }, [isOpen, baseYear, majors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.student_name || !formData.major || !formData.class_info || !formData.student_number) {
      toast({ variant: 'destructive', title: '입력 오류', description: '모든 필수 항목을 입력해주세요.' })
      return
    }

    setIsSubmitting(true)
    const result = await createStudent({
      ...formData,
      graduation_year: parseInt(formData.graduation_year)
    })

    if (result.success) {
      toast({ title: '학생 등록 완료', description: `${formData.student_name} 학생이 성공적으로 등록되었습니다.` })
      onClose()
    } else {
      toast({ variant: 'destructive', title: '등록 실패', description: result.error })
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">신규 학생 등록</DialogTitle>
              <p className="text-indigo-100 text-xs mt-1">개별 학생 정보를 시스템에 추가합니다.</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student_name" className="text-xs font-bold text-slate-500">성명 *</Label>
                <Input 
                  id="student_name" 
                  placeholder="홍길동" 
                  value={formData.student_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
                  className="h-10 border-slate-200 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="graduation_year" className="text-xs font-bold text-slate-500">학년(졸업연도) *</Label>
                <Select 
                  value={formData.graduation_year} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, graduation_year: v }))}
                >
                  <SelectTrigger className="h-10 border-slate-200">
                    <SelectValue placeholder="연도 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={(baseYear + 1).toString()}>3학년 ({(baseYear + 1)}년 졸업)</SelectItem>
                    <SelectItem value={(baseYear + 2).toString()}>2학년 ({(baseYear + 2)}년 졸업)</SelectItem>
                    <SelectItem value={(baseYear + 3).toString()}>1학년 ({(baseYear + 3)}년 졸업)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="major" className="text-xs font-bold text-slate-500">학과 *</Label>
              <Select 
                value={formData.major} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, major: v }))}
              >
                <SelectTrigger className="h-10 border-slate-200">
                  <SelectValue placeholder="학과 선택" />
                </SelectTrigger>
                <SelectContent>
                  {majors.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class_info" className="text-xs font-bold text-slate-500">반 (숫자만) *</Label>
                <Input 
                  id="class_info" 
                  placeholder="예: 1" 
                  value={formData.class_info}
                  onChange={(e) => setFormData(prev => ({ ...prev, class_info: e.target.value }))}
                  className="h-10 border-slate-200 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student_number" className="text-xs font-bold text-slate-500">번호 (숫자만) *</Label>
                <Input 
                  id="student_number" 
                  placeholder="예: 15" 
                  value={formData.student_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_number: e.target.value }))}
                  className="h-10 border-slate-200 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t gap-2 mt-0">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 font-medium px-6 text-slate-500">취소</Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 h-10 px-10 font-bold shadow-lg shadow-indigo-100 gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              학생 등록하기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
