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

import { useRouter } from 'next/navigation'

interface FieldTrainingModalProps {
  isOpen: boolean
  onClose: () => void
  student: any | null
  isAdmin?: boolean
  onUpdateRecords?: (studentId: string, updatedRecords: any[]) => void
  masterCompanies?: any[]
}

// 텍스트 자유 입력, 복사-붙여넣기, 자동 형식 정제 및 달력 선택을 동시 지원하는 스마트 날짜 인풋
function SmartDateInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'YYYY-MM-DD'
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [textVal, setTextVal] = React.useState(value || '');

  React.useEffect(() => {
    setTextVal(value || '');
  }, [value]);

  const normalizeDateStr = (raw: string) => {
    if (!raw) return '';
    const cleaned = raw.replace(/[^\d]/g, ''); // 숫자만 추출
    if (cleaned.length === 8) {
      // YYYYMMDD -> YYYY-MM-DD
      const y = cleaned.slice(0, 4);
      const m = cleaned.slice(4, 6);
      const d = cleaned.slice(6, 8);
      return `${y}-${m}-${d}`;
    }
    // 2026.08.01 or 2026/08/01 -> 2026-08-01
    return raw.trim().replace(/[\.\/]/g, '-');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextVal(raw);
    const normalized = normalizeDateStr(raw);
    onChange(normalized);
  };

  const handleBlur = () => {
    const normalized = normalizeDateStr(textVal);
    setTextVal(normalized);
    onChange(normalized);
  };

  return (
    <div className="relative flex items-center">
      <Input
        type="text"
        value={textVal}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("pr-8 font-mono text-xs sm:text-sm bg-white border-slate-200 focus:ring-emerald-500", className)}
      />
      <input
        type="date"
        value={value || ''}
        onChange={(e) => {
          setTextVal(e.target.value);
          onChange(e.target.value);
        }}
        disabled={disabled}
        className="absolute right-1 w-6 h-6 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        title="달력에서 날짜 선택"
      />
      <CalendarIcon className="absolute right-2 h-4 w-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

export function FieldTrainingModal({ isOpen, onClose, student, isAdmin = false, onUpdateRecords, masterCompanies = [] }: FieldTrainingModalProps) {
  const [records, setRecords] = React.useState<any[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()
  const router = useRouter()

  React.useEffect(() => {
    if (student && student.training_records) {
      setRecords([...student.training_records].sort((a, b) => b.training_order - a.training_order))
    } else {
      setRecords([])
    }

    if (!isOpen) {
      // Radix UI 모달 닫힘 후 body의 pointer-events: none 고립 현상 방지 구원 코드
      const timer = setTimeout(() => {
        if (typeof document !== 'undefined') {
          document.body.style.pointerEvents = ''
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [student, isOpen])

  const handleAddRecord = () => {
    const nextOrder = records.length > 0 ? Math.max(...records.map(r => r.training_order)) + 1 : 1
    const newRecord = {
      id: `temp-${Date.now()}`,
      student_id: student.id,
      training_order: nextOrder,
      company: '',
      start_date: '',
      end_date: '',
      stipend_status: 'X',
      hiring_status: '현장실습',
      conversion_date: '',
      return_reason: ''
    }
    setRecords([newRecord, ...records])
  }

  const handleUpdateLocal = (index: number, field: string, value: any) => {
    const newRecords = [...records]
    const target = { ...newRecords[index], [field]: value }

    if (field === 'hiring_status') {
      if (value === '채용전환') {
        // [자동 채움] 채용전환 선택 시: 채용전환일 기본값을 현장실습종료일(end_date)로 자동 설정
        if (!target.conversion_date) {
          target.conversion_date = target.end_date || ''
        }
        target.return_reason = ''
      } else if (value === '현장실습' || value === '진행중') {
        // [자동 삭제] 현장실습으로 변경 시: 채용전환일 및 복교사유 초기화/삭제
        target.conversion_date = ''
        target.return_reason = ''
      } else if (value === '복교') {
        target.conversion_date = ''
      }
    }

    newRecords[index] = target
    setRecords(newRecords)
  }

  const handleSaveRecord = async (index: number) => {
    const record = { ...records[index] }
    
    if (!record.company) {
      toast({ variant: 'destructive', title: '저장 실패', description: '실습 업체명을 입력해주세요.' })
      return
    }

    // 채용전환이 아닌 경우 채용전환일 초기화
    if (record.hiring_status !== '채용전환') {
      record.conversion_date = ''
    }
    // 복교가 아닌 경우 복교사유 초기화
    if (record.hiring_status !== '복교') {
      record.return_reason = ''
    }

    // 1. [0.001초 낙관적 즉시 반영]: 모달 및 부모 간트차트/통계 즉시 갱신
    const optimisticRecord = { ...record }
    const optimisticList = [...records]
    optimisticList[index] = optimisticRecord
    setRecords(optimisticList)
    onUpdateRecords?.(student.id, optimisticList)
    toast({ title: '저장 완료 (즉시 반영)', description: `${record.training_order}차 실습 정보가 즉시 반영되었습니다.` })

    // 2. [백그라운드 비동기 DB 저장]: 화면 멈춤 없이 백그라운드 동기화
    if (typeof record.id === 'string' && record.id.startsWith('temp-')) {
      delete record.id
    }

    try {
      const result = await upsertFieldTrainingRecord(record)
      if (result.success && result.data) {
        setRecords(prev => {
          const updated = [...prev]
          if (updated[index]) {
            updated[index] = { ...updated[index], id: result.data.id }
          }
          return updated
        })
      } else if (!result.success) {
        toast({ variant: 'destructive', title: '서버 저장 실패', description: result.error })
      }
    } catch (err: any) {
      console.error('현장실습 저장 에러:', err)
    }
  }

  const handleDeleteRecord = async (index: number) => {
    const record = records[index]
    if (!confirm(`${record.training_order}차 실습 이력을 영구 삭제하시겠습니까?`)) return

    // 1. [0.001초 낙관적 즉시 삭제]: 모달 및 부모 간트차트에서 즉시 삭제
    const nextRecords = records.filter((_, i) => i !== index)
    setRecords(nextRecords)
    onUpdateRecords?.(student.id, nextRecords)
    toast({ title: '삭제 완료 (즉시 반영)', description: '실습 이력이 즉시 삭제되었습니다.' })

    // 2. [백그라운드 비동기 DB 삭제]
    if (record.id && !String(record.id).startsWith('temp-')) {
      try {
        const result = await deleteFieldTrainingRecord(record.id)
        if (!result.success) {
          toast({ variant: 'destructive', title: '삭제 실패', description: result.error })
        }
      } catch (err: any) {
        console.error('현장실습 삭제 에러:', err)
      }
    }
  }

  if (!student) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[95vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mr-6 sm:mr-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
                <History className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <DialogTitle className="text-base sm:text-xl font-extrabold flex items-center gap-2 text-slate-900 truncate">
                  현장실습 이력 관리
                  {!isAdmin && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0 font-bold">
                      조회 전용 모드
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                  {student.student_name} ({student.major} {student.class_info}반 {student.student_number ? `${student.student_number}번` : ''})
                </DialogDescription>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-tighter mb-0.5">실습 이력</p>
              <p className="text-lg sm:text-2xl font-black text-emerald-600">{records.length}건</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50/50">
          <div className="flex items-center justify-between border-b pb-3 sm:pb-4 border-slate-200">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
              <Building2 className="h-4 w-4 text-emerald-600" />
              등록된 실습 목록 ({records.length}건)
            </h3>
            {isAdmin && (
              <Button size="sm" onClick={handleAddRecord} className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-8 sm:h-9 text-xs shadow-sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> 실습 추가
              </Button>
            )}
          </div>

          <div className="space-y-4 pb-10">
            {records.length > 0 ? (
              records.map((record, index) => {
                const recordKey = record.id || `idx-${index}`
                return (
                  <div key={recordKey} className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* 카드 헤더 */}
                    <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Badge variant="outline" className="bg-white font-bold border-slate-300 text-[10px] px-1.5 h-5 shrink-0">
                          {record.training_order}차
                        </Badge>
                        <span className="font-bold text-slate-700 truncate text-xs sm:text-sm">
                          {record.company || '업체명 미입력'}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDeleteRecord(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            className="h-7 px-2 sm:h-8 sm:px-3 bg-slate-800 hover:bg-slate-900 font-bold text-[10px] sm:text-[11px]"
                            onClick={() => handleSaveRecord(index)}
                            disabled={isSaving}
                          >
                            <Save className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> 저장
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 카드 본문 */}
                    <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">실습 업체명</Label>
                        <div className="space-y-1">
                          <Input 
                            value={record.company || ''} 
                            onChange={(e) => handleUpdateLocal(index, 'company', e.target.value)}
                            placeholder="회사명 입력..."
                            disabled={!isAdmin}
                            className="h-8 sm:h-9 text-xs sm:text-sm focus:ring-indigo-500"
                          />
                          {isAdmin && masterCompanies && masterCompanies.length > 0 && record.company && (
                            (() => {
                              const search = (record.company || '').trim().toLowerCase();
                              const matches = masterCompanies.filter((c: any) => (c.name || '').toLowerCase().includes(search)).slice(0, 5);
                              if (matches.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  <span className="text-[9px] text-slate-400 font-bold self-center">추천:</span>
                                  {matches.map((c: any) => (
                                    <button
                                      key={c.id || c.name}
                                      type="button"
                                      onClick={() => handleUpdateLocal(index, 'company', c.name)}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                                    >
                                      {c.name}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">실습내용</Label>
                        <Select 
                          value={record.hiring_status === '진행중' ? '현장실습' : (record.hiring_status || '현장실습')} 
                          onValueChange={(v) => handleUpdateLocal(index, 'hiring_status', v)}
                          disabled={!isAdmin}
                        >
                          <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[150]">
                            <SelectItem value="현장실습" className="text-xs">🏃 현장실습</SelectItem>
                            <SelectItem value="채용전환" className="text-xs">🎯 채용전환</SelectItem>
                            <SelectItem value="복교" className="text-xs">↩️ 복교</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">시작일 (직접 입력/복사 가능)</Label>
                          <SmartDateInput 
                            value={record.start_date || ''} 
                            onChange={(val) => handleUpdateLocal(index, 'start_date', val)}
                            disabled={!isAdmin}
                            placeholder="2026-08-01"
                            className="h-8 sm:h-9"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">종료일 (직접 입력/복사 가능)</Label>
                          <SmartDateInput 
                            value={record.end_date || ''} 
                            onChange={(val) => handleUpdateLocal(index, 'end_date', val)}
                            disabled={!isAdmin}
                            placeholder="2026-11-30"
                            className="h-8 sm:h-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">지원금 신청</Label>
                        <Select 
                          value={record.stipend_status || 'X'} 
                          onValueChange={(v) => handleUpdateLocal(index, 'stipend_status', v)}
                          disabled={!isAdmin}
                        >
                          <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[150]">
                            <SelectItem value="O" className="text-xs">신청 (O)</SelectItem>
                            <SelectItem value="X" className="text-xs">미신청 (X)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {record.hiring_status === '채용전환' ? (
                        <div className="space-y-1 animate-in fade-in zoom-in-95">
                          <Label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">채용 전환일 (직접 입력/복사 가능)</Label>
                          <SmartDateInput 
                            value={record.conversion_date || ''} 
                            onChange={(val) => handleUpdateLocal(index, 'conversion_date', val)}
                            disabled={!isAdmin}
                            placeholder="2026-12-01"
                            className="h-8 sm:h-9 text-blue-900 border-blue-200 bg-blue-50/30"
                          />
                        </div>
                      ) : record.hiring_status === '복교' ? (
                        <div className="space-y-1 animate-in fade-in zoom-in-95">
                          <Label className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">복교 사유</Label>
                          <div className="relative">
                            <RotateCcw className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-rose-400" />
                            <Input 
                              value={record.return_reason || ''} 
                              onChange={(e) => handleUpdateLocal(index, 'return_reason', e.target.value)}
                              placeholder="사유"
                              disabled={!isAdmin}
                              className="h-8 sm:h-9 pl-8 border-rose-200 bg-rose-50/30 text-[10px] sm:text-xs"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-16 sm:py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl sm:rounded-3xl">
                <p className="text-slate-400 text-xs sm:text-sm">등록된 실습 이력이 없습니다.</p>
                <p className="text-slate-300 text-[10px] sm:text-xs mt-1">상단의 '추가' 버튼을 눌러 기록을 시작하세요.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 bg-white border-t shrink-0">
          <Button variant="ghost" onClick={onClose} className="h-10 sm:h-11 font-bold text-xs sm:text-sm">창 닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
