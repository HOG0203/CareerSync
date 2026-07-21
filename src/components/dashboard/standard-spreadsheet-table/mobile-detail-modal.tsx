'use client'

import * as React from 'react'
import { X, UserPlus, ChevronRight, Award, BookUser, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { normalizeCertificates } from './utils'

export const MobileDetailModal = ({ isOpen, onClose, data, columns, onSave, onAction }: any) => {
  if (!data) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-[500px] border-none rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-indigo-600 text-white shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2"><UserPlus className="h-5 w-5" /> 상세 정보 및 관리</DialogTitle>
          <DialogDescription className="text-indigo-100 text-[10px]">{data.student_name || data.name} 학생 관리</DialogDescription>
        </DialogHeader>
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="space-y-2">
            {columns.filter((c: any) => c.type === 'action').map((col: any) => (
              <Button key={col.key} variant="outline" className={cn("w-full h-14 border-indigo-100 bg-white font-bold flex justify-between px-4 group hover:bg-indigo-100 shadow-sm rounded-xl", col.key === 'field_training_action' ? "text-emerald-700 border-emerald-100 hover:bg-emerald-50" : "text-indigo-700")} onClick={() => { onClose(); onAction?.(data.id, col.key); }}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg transition-colors", col.key === 'field_training_action' ? "bg-emerald-100 group-hover:bg-emerald-200" : "bg-indigo-100 group-hover:bg-indigo-200")}>
                    {col.key === 'field_training_action' ? <Award className="h-5 w-5 text-emerald-600" /> : <BookUser className="h-5 w-5 text-indigo-600" />}
                  </div>
                  <span className="text-base">{col.label} 열기</span>
                </div>
                <ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {columns.filter((c: any) => c.type !== 'action').map((col: any) => {
              const resolvedOptions = typeof col.options === 'function' ? col.options(data) : col.options;
              return (
                <div key={col.key} className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col.label}</label>
                  {col.readOnly ? (
                    <div className="text-sm font-semibold text-slate-700 h-10 flex items-center px-1">
                      {col.key === 'phone_number' && data[col.key] ? (
                        <a href={`tel:${data[col.key]}`} className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline">
                          <span>{data[col.key]}</span>
                          <Phone className="h-4 w-4 text-indigo-500 shrink-0" />
                        </a>
                      ) : (
                        data[col.key] || '-'
                      )}
                    </div>
                  ) : col.type === 'multi-select' ? (
                    <div className="flex flex-wrap gap-1 p-2 border border-slate-200 rounded-md bg-white min-h-10 items-center">
                      {normalizeCertificates(data[col.key]).map((cert, i) => (<Badge key={i} variant="secondary" className="text-[10px] bg-slate-100">{cert}</Badge>))}
                      <Button variant="ghost" size="sm" className="h-7 ml-auto text-indigo-600 font-bold hover:bg-indigo-50" onClick={() => onSave(data.id, col.key, 'OPEN_PICKER')}>수정하기</Button>
                    </div>
                  ) : col.type === 'select' ? (
                    (() => {
                      const isInOptions = resolvedOptions?.some((o: any) => o.value === data[col.key]);
                      const isOtherTrigger = data[col.key] === '기타(직접입력)';
                      const isCustom = data[col.key] && !isInOptions;
                      if (isOtherTrigger || isCustom) {
                        return (
                          <div className="relative">
                            <Input autoFocus value={isOtherTrigger ? '' : data[col.key] || ''} onChange={(e) => onSave(data.id, col.key, e.target.value)} className="h-10 w-full bg-white pr-10 font-medium" placeholder="내용 입력..." />
                            <button onClick={() => onSave(data.id, col.key, '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"><X className="h-4 w-4" /></button>
                          </div>
                        );
                      }
                      return (
                        <Select value={isInOptions ? data[col.key] : ''} onValueChange={(v) => { if (v === '기타(직접입력)') onSave(data.id, col.key, '기타(직접입력)'); else onSave(data.id, col.key, v); }}>
                          <SelectTrigger className="h-10 w-full bg-white"><SelectValue placeholder="선택..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CLEARED" className="text-rose-500 font-bold">선택 취소 (비우기)</SelectItem>
                            {resolvedOptions?.map((o: any) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      );
                    })()
                  ) : col.type === 'date' ? (
                    <div className="flex gap-1">
                      <Popover>
                        <PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-start text-sm h-10 font-medium">{data[col.key] || '날짜 선택...'}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={data[col.key] ? new Date(data[col.key]) : undefined} onSelect={(date) => date && onSave(data.id, col.key, format(date, 'yyyy-MM-dd'))} locale={ko} /></PopoverContent>
                      </Popover>
                      {data[col.key] && (<Button variant="outline" size="icon" className="h-10 w-10 shrink-0 text-slate-400 hover:text-rose-500" onClick={() => onSave(data.id, col.key, '')}><X className="h-4 w-4" /></Button>)}
                    </div>
                  ) : (
                    <div className="relative">
                      <Input value={data[col.key] || ''} onChange={(e) => onSave(data.id, col.key, e.target.value)} className="h-10 w-full bg-white pr-10 font-medium" />
                      {data[col.key] && (<button onClick={() => onSave(data.id, col.key, '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"><X className="h-4 w-4" /></button>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="p-4 bg-white border-t shrink-0">
          <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 font-bold text-lg rounded-xl">창 닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
