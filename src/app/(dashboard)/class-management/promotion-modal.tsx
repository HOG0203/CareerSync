'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { GraduationCap, ArrowRight, Save, LayoutGrid, Building2, Loader2 } from 'lucide-react'
import { promoteStudents } from './actions'
import { useToast } from '@/hooks/use-toast'

interface PromotionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedStudents: any[]
}

export function PromotionModal({ isOpen, onClose, selectedStudents }: PromotionModalProps) {
  const [promotionData, setPromotionData] = React.useState<any[]>([])
  const [batchClass, setBatchClass] = React.useState('')
  const [batchMajor, setBatchMajor] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()

  // 시스템에 등록된 전체 학과 목록 추출
  const availableMajors = React.useMemo(() => 
    Array.from(new Set(selectedStudents.map(s => s.major))).filter(Boolean).sort() as string[]
  , [selectedStudents])

  React.useEffect(() => {
    if (isOpen) {
      setPromotionData(selectedStudents.map(s => ({
        id: s.id,
        student_name: s.student_name,
        current_major: s.major,
        current_class: s.class_info,
        current_number: s.student_number,
        next_major: s.major,
        next_class: s.class_info,
        next_number: s.student_number
      })))
      setBatchClass('')
      setBatchMajor('')
    }
  }, [isOpen, selectedStudents])

  const handleUpdate = (id: string, field: string, value: any) => {
    setPromotionData(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const applyBatchClass = () => {
    if (!batchClass) return
    setPromotionData(prev => prev.map(p => ({ ...p, next_class: batchClass })))
    toast({ title: '일괄 적용 완료', description: `모든 학생의 반을 ${batchClass}반으로 설정했습니다.` })
  }

  const applyBatchMajor = () => {
    if (!batchMajor) return
    setPromotionData(prev => prev.map(p => ({ ...p, next_major: batchMajor })))
    toast({ title: '일괄 적용 완료', description: `모든 학생의 학과를 ${batchMajor}(으)로 설정했습니다.` })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const result = await promoteStudents(promotionData)
    if (result.success) {
      toast({ title: '소속 정보 업데이트 완료', description: `${promotionData.length}명의 학생 정보가 갱신되었습니다.` })
      onClose()
    } else {
      toast({ variant: 'destructive', title: '처리 실패', description: result.error })
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] h-[700px] p-0 overflow-hidden flex flex-col border-none shadow-2xl">
        <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">학생 소속 정보 변경</DialogTitle>
              <DialogDescription className="text-indigo-100 text-xs mt-1">
                선택된 {selectedStudents.length}명의 학생에 대한 새로운 학과/학반 정보를 설정합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-indigo-50 border-b flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-700">일괄 설정</span>
            </div>
            
            <div className="flex items-center gap-1.5 ml-2">
              <Input 
                placeholder="반" 
                className="w-20 h-8 text-xs bg-white border-indigo-200" 
                value={batchClass}
                onChange={(e) => setBatchClass(e.target.value)}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold bg-white text-indigo-600 border-indigo-200" onClick={applyBatchClass}>
                반 적용
              </Button>
            </div>

            <div className="flex items-center gap-1.5 ml-2 border-l border-indigo-200 pl-4">
              <select 
                className="h-8 text-xs bg-white border border-indigo-200 rounded-md px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                value={batchMajor}
                onChange={(e) => setBatchMajor(e.target.value)}
              >
                <option value="">학과 선택</option>
                {availableMajors.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold bg-white text-indigo-600 border-indigo-200" onClick={applyBatchMajor}>
                학과 적용
              </Button>
            </div>
          </div>
          <div className="text-[10px] text-indigo-400 font-medium italic">
            * 학생의 졸업연도(기수)는 고정됩니다.
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-slate-200/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
            <div className="col-span-2">학생 정보</div>
            <div className="col-span-2 text-center">현재 소속</div>
            <div className="col-span-1 text-center"></div>
            <div className="col-span-7 text-center text-indigo-600">진급 후 소속 (수정 가능)</div>
          </div>
          
          <ScrollArea className="flex-1 w-full">
            <div className="p-4 space-y-2">
              {promotionData.map((p) => (
                <div key={p.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="col-span-2">
                    <span className="text-xs font-bold text-slate-700">{p.student_name}</span>
                  </div>
                  
                  <div className="col-span-2 flex justify-center items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <span>{p.current_class}반</span>
                    <span>{p.current_number}번</span>
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                  </div>

                  <div className="col-span-7 flex items-center gap-2 justify-end">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Building2 className="h-3 w-3 text-indigo-300 shrink-0" />
                      <select 
                        value={p.next_major} 
                        onChange={(e) => handleUpdate(p.id, 'next_major', e.target.value)}
                        className="w-full h-8 text-[11px] font-bold border border-indigo-100 rounded-md px-1.5 focus:ring-1 focus:ring-indigo-500 outline-none bg-indigo-50/30"
                      >
                        {availableMajors.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold">반</span>
                      <Input 
                        value={p.next_class} 
                        onChange={(e) => handleUpdate(p.id, 'next_class', e.target.value)}
                        className="w-14 h-8 text-center text-xs font-black border-indigo-100 focus:ring-indigo-500 bg-indigo-50/30"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold">번</span>
                      <Input 
                        value={p.next_number} 
                        onChange={(e) => handleUpdate(p.id, 'next_number', e.target.value)}
                        className="w-14 h-8 text-center text-xs font-black border-indigo-100 focus:ring-indigo-500 bg-indigo-50/30"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex items-center justify-between sm:justify-between">
          <div className="flex items-center text-[10px] text-slate-400 gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            상담 기록 및 자격증 정보는 변경된 소속으로 자동 인계됩니다.
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="h-10 px-6 font-medium text-slate-500">취소</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 h-10 px-10 font-bold shadow-lg shadow-indigo-100 gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              설정 저장 및 진급 실행
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
