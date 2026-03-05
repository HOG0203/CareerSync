'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format, parseISO, isValid } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon, Plus, Trash2, Save, History, Building2, CheckCircle2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertFieldTrainingRecord, deleteFieldTrainingRecord } from '@/app/students/actions'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

interface FieldTrainingModalProps {
  isOpen: boolean
  onClose: () => void
  student: any | null
}

export function FieldTrainingModal({ isOpen, onClose, student }: FieldTrainingModalProps) {
  const [records, setRecords] = React.useState<any[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const [openPopovers, setOpenPopovers] = React.useState<Record<string, boolean>>({})
  const { toast } = useToast()

  React.useEffect(() => {
    if (student && student.training_records) {
      setRecords([...student.training_records].sort((a, b) => b.training_order - a.training_order))
    } else {
      setRecords([])
    }
    setOpenPopovers({})
  }, [student, isOpen])

  const togglePopover = (key: string, open: boolean) => {
    setOpenPopovers(prev => ({ ...prev, [key]: open }))
  }

  const handleAddRecord = () => {
    const nextOrder = records.length > 0 ? Math.max(...records.map(r => r.training_order)) + 1 : 1
    const newRecord = {
      id: `temp-${Date.now()}`, // 임시 ID 부여로 고유 키 보장
      student_id: student.id,
      training_order: nextOrder,
      company: '',
      start_date: '',
      end_date: '',
      stipend_status: 'X',
      hiring_status: '진행중',
      conversion_date: '',
      return_reason: ''
    }
    setRecords([newRecord, ...records])
  }

  const handleUpdateLocal = (index: number, field: string, value: any) => {
    const newRecords = [...records]
    newRecords[index] = { ...newRecords[index], [field]: value }
    setRecords(newRecords)
  }

  const handleDateSelect = (index: number, field: string, date: Date | undefined, popoverKey: string) => {
    const dateStr = date && isValid(date) ? format(date, 'yyyy-MM-dd') : ''
    handleUpdateLocal(index, field, dateStr)
    togglePopover(popoverKey, false) // 날짜 선택 후 팝업 닫기
  }

  const handleSaveRecord = async (index: number) => {
    setIsSaving(true)
    const record = { ...records[index] }
    
    if (!record.company) {
      toast({ variant: 'destructive', title: '저장 실패', description: '실습 업체명을 입력해주세요.' })
      setIsSaving(false)
      return
    }

    // 임시 ID 제거 후 저장
    if (typeof record.id === 'string' && record.id.startsWith('temp-')) {
      delete record.id
    }

    const result = await upsertFieldTrainingRecord(record)
    if (result.success) {
      toast({ title: '저장 완료', description: `${record.training_order}차 실습 정보가 저장되었습니다.` })
      if (result.data) {
        const newRecords = [...records]
        newRecords[index] = result.data
        setRecords(newRecords)
      }
    } else {
      console.error('현장실습 저장 에러 상세:', result.error)
      toast({ variant: 'destructive', title: '저장 실패', description: result.error })
    }
    setIsSaving(false)
  }

  const handleDeleteRecord = async (index: number) => {
    const record = records[index]
    if (!record.id || (typeof record.id === 'string' && record.id.startsWith('temp-'))) {
      setRecords(records.filter((_, i) => i !== index))
      return
    }

    if (!confirm(`${record.training_order}차 실습 이력을 영구 삭제하시겠습니까?`)) return

    setIsSaving(true)
    const result = await deleteFieldTrainingRecord(record.id)
    if (result.success) {
      toast({ title: '삭제 완료', description: '실습 이력이 삭제되었습니다.' })
      setRecords(records.filter((_, i) => i !== index))
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error })
    }
    setIsSaving(false)
  }

  const safeParseDate = (dateStr: string) => {
    if (!dateStr) return undefined
    const date = parseISO(dateStr)
    return isValid(date) ? date : undefined
  }

  if (!student) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400">
              <History className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">현장실습 이력 관리</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-1">
                {student.student_name} ({student.major} {student.class_info}반 {student.student_number}번) 학생의 실습 과정을 관리합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          <div className="flex items-center justify-between border-b pb-4 border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              실습 참여 목록 ({records.length}건)
            </h3>
            <Button size="sm" onClick={handleAddRecord} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
              <Plus className="h-4 w-4 mr-1.5" /> 새 실습 추가
            </Button>
          </div>

          <div className="space-y-4 pb-10">
            {records.length > 0 ? (
              records.map((record, index) => {
                const recordKey = record.id || `idx-${index}`
                return (
                  <div key={recordKey} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* 카드 헤더 */}
                    <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-white font-bold border-slate-300">
                          {record.training_order}회차
                        </Badge>
                        <span className="font-bold text-slate-700 truncate max-w-[200px]">
                          {record.company || '업체명 미입력'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleDeleteRecord(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 px-3 bg-slate-800 hover:bg-slate-900 font-bold text-[11px]"
                          onClick={() => handleSaveRecord(index)}
                          disabled={isSaving}
                        >
                          <Save className="h-3.5 w-3.5 mr-1.5" /> 저장
                        </Button>
                      </div>
                    </div>

                    {/* 카드 본문 */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">실습 업체명</Label>
                        <Input 
                          value={record.company || ''} 
                          onChange={(e) => handleUpdateLocal(index, 'company', e.target.value)}
                          placeholder="회사명을 입력하세요"
                          className="h-9 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">실습 결과</Label>
                        <Select 
                          value={record.hiring_status || '진행중'} 
                          onValueChange={(v) => handleUpdateLocal(index, 'hiring_status', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="진행중">⏳ 진행중</SelectItem>
                            <SelectItem value="채용전환">✅ 채용전환</SelectItem>
                            <SelectItem value="복교">🔄 복교</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">실습 시작일</Label>
                        <Popover 
                          open={openPopovers[`${recordKey}-start`]} 
                          onOpenChange={(open) => togglePopover(`${recordKey}-start`, open)}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-xs", !record.start_date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {record.start_date || "날짜 선택"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-auto p-0 z-[120] pointer-events-auto" 
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div onPointerDown={(e) => e.stopPropagation()} className="pointer-events-auto">
                              <Calendar 
                                mode="single" 
                                selected={safeParseDate(record.start_date)} 
                                onSelect={(date) => handleDateSelect(index, 'start_date', date, `${recordKey}-start`)}
                                locale={ko}
                                initialFocus
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">실습 종료일</Label>
                        <Popover 
                          open={openPopovers[`${recordKey}-end`]} 
                          onOpenChange={(open) => togglePopover(`${recordKey}-end`, open)}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-xs", !record.end_date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {record.end_date || "날짜 선택"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-auto p-0 z-[120] pointer-events-auto" 
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div onPointerDown={(e) => e.stopPropagation()} className="pointer-events-auto">
                              <Calendar 
                                mode="single" 
                                selected={safeParseDate(record.end_date)} 
                                onSelect={(date) => handleDateSelect(index, 'end_date', date, `${recordKey}-end`)}
                                locale={ko}
                                initialFocus
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">지원금 신청 여부</Label>
                        <Select 
                          value={record.stipend_status || 'X'} 
                          onValueChange={(v) => handleUpdateLocal(index, 'stipend_status', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[120]">
                            <SelectItem value="O">신청 (O)</SelectItem>
                            <SelectItem value="X">미신청 (X)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {record.hiring_status === '채용전환' ? (
                        <div className="space-y-1.5 animate-in fade-in zoom-in-95">
                          <Label className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">채용 전환일</Label>
                          <Popover 
                            open={openPopovers[`${recordKey}-conv`]} 
                            onOpenChange={(open) => togglePopover(`${recordKey}-conv`, open)}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-xs border-blue-200 bg-blue-50/30", !record.conversion_date && "text-muted-foreground")}>
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                {record.conversion_date || "전환일 선택"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-auto p-0 z-[120] pointer-events-auto" 
                              align="start"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div onPointerDown={(e) => e.stopPropagation()} className="pointer-events-auto">
                                <Calendar 
                                  mode="single" 
                                  selected={safeParseDate(record.conversion_date)} 
                                  onSelect={(date) => handleDateSelect(index, 'conversion_date', date, `${recordKey}-conv`)}
                                  locale={ko}
                                  initialFocus
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : record.hiring_status === '복교' ? (
                        <div className="space-y-1.5 animate-in fade-in zoom-in-95">
                          <Label className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">복교 사유</Label>
                          <div className="relative">
                            <RotateCcw className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400" />
                            <Input 
                              value={record.return_reason || ''} 
                              onChange={(e) => handleUpdateLocal(index, 'return_reason', e.target.value)}
                              placeholder="복교 사유를 입력하세요"
                              className="h-9 pl-9 border-rose-200 bg-rose-50/30 text-xs"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-3xl">
                <p className="text-slate-400 text-sm">등록된 실습 이력이 없습니다.</p>
                <p className="text-slate-300 text-xs mt-1">상단의 '새 실습 추가' 버튼을 눌러 기록을 시작하세요.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-white border-t shrink-0">
          <Button variant="ghost" onClick={onClose} className="h-11 font-bold">창 닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
