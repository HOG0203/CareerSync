'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Search, X, ListFilter, Check, Trash2, GraduationCap, Award, ChevronRight, UserPlus, Loader2, BookUser, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRouter } from 'next/navigation'

export interface ColumnConfig {
  key: string
  label: string
  width: number
  type?: 'text' | 'select' | 'date' | 'multi-select' | 'action'
  options?: { label: string; value: string }[] | ((rowData: any) => { label: string; value: string }[])
  readOnly?: boolean
  variant?: (val: any) => string
}

interface SpreadsheetTableProps {
  data: any[]
  columns: ColumnConfig[]
  onSave: (id: string, field: string, value: any) => Promise<{ success: boolean; error?: string }>
  onBulkSave: (updates: { id: string; field: string; value: any }[]) => Promise<{ success: boolean; error?: string }>
  onPromote?: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  onDelete?: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  onAction?: (id: string, key: string) => void
  selectedRowIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  groupHeaders?: { label: string; colSpan: number; className?: string }[]
  searchPlaceholder?: string
  masterCertificates?: any[]
}

const normalizeCertificates = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
  if (typeof value === 'string') return value.replace(/[\\"[\]]/g, '').split(',').map(v => v.trim()).filter(Boolean);
  return [];
};

// --- 테이블 헤더 ---
const TableHeader = React.memo(({ columns, groupHeaders, filterOptions, columnFilters, onFilterChange, onSelectAll, isAllSelected }: any) => {
  const hasGroup = !!groupHeaders;
  return (
    <thead className="text-muted-foreground select-none relative z-30">
      {groupHeaders && (
        <tr className="h-10">
          <th className="sticky top-0 z-40 border-r border-b w-8 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]"></th>
          {groupHeaders.map((h: any, i: number) => (
            <th key={i} colSpan={h.colSpan} className={cn("sticky top-0 z-40 text-center border-r border-b font-bold p-0 text-[11px] bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", h.className)}>{h.label}</th>
          ))}
        </tr>
      )}
      <tr className="h-10">
        <th className={cn("sticky z-40 border-r border-b w-8 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", hasGroup ? "top-10" : "top-0")}><div className="flex items-center justify-center h-10"><Checkbox checked={isAllSelected} onCheckedChange={onSelectAll} /></div></th>
        {columns.map((col: any) => (
          <th key={col.key} className={cn("sticky z-40 group text-center border-r border-b font-semibold p-0 hover:bg-slate-100 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", hasGroup ? "top-10" : "top-0")} style={{ minWidth: col.width, width: 'auto' }}>
            <div className="flex items-center justify-center px-2 gap-1 h-full min-h-[40px]">
              <span className="whitespace-pre-line leading-tight py-1">{col.label}</span>
              <Popover>
                <PopoverTrigger asChild><button className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"><ListFilter className="h-3 w-3" /></button></PopoverTrigger>
                <PopoverContent className="w-48 p-0 z-[50]" align="start">
                  <div className="max-h-60 overflow-y-auto p-1">
                    {(filterOptions[col.key] || []).map((val: any) => (
                      <div key={String(val)} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-sm cursor-pointer" onClick={() => onFilterChange(col.key, String(val))}><Checkbox checked={(columnFilters[col.key] || []).includes(String(val))} /><label className="text-[11px] cursor-pointer flex-1 truncate">{String(val)}</label></div>
                    ))}
                  </div>
                  <div className="p-1 border-t"><Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={() => onFilterChange(col.key, 'RESET')}>필터 해제</Button></div>
                </PopoverContent>
              </Popover>
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
});
TableHeader.displayName = 'TableHeader';

// --- 데이터 셀 ---
const SpreadsheetCell = React.memo(({ id, field, value, config, rowData, isEditing, isSelected, isFocused, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, onAction }: any) => {
  const [localValue, setLocalValue] = React.useState(value || '')
  const [isManualInput, setIsManualInput] = React.useState(false)
  const isManualRef = React.useRef(false)
  
  const resolvedOptions = React.useMemo(() => {
    if (typeof config.options === 'function') return config.options(rowData);
    return config.options;
  }, [config.options, rowData]);

  React.useEffect(() => { 
    if (isEditing) {
      setLocalValue(value || '')
      const isInOptions = resolvedOptions?.some((o: any) => o.value === value);
      const isManual = !!value && !isInOptions && value !== '기타(직접입력)';
      setIsManualInput(isManual);
      isManualRef.current = isManual;
    } else {
      setIsManualInput(false)
      isManualRef.current = false
    }
  }, [value, isEditing, resolvedOptions])
  
  React.useEffect(() => {
    if (isEditing && config.type === 'multi-select') {
      const timer = setTimeout(() => onSave(id, field, 'OPEN_PICKER'), 0);
      return () => clearTimeout(timer);
    }
  }, [isEditing, config.type, id, field, onSave]);

  const handleCommit = React.useCallback((v: any) => { 
    const finalVal = v === '기타(직접입력)' ? '' : v;
    if (finalVal !== value) onSave(id, field, finalVal); 
    onEndEdit(); 
  }, [id, field, value, onSave, onEndEdit]);

  if (isEditing) {
    if (config.type === 'select') {
      const isInOptions = resolvedOptions?.some((o: any) => o.value === localValue);
      const isOtherTrigger = localValue === '기타(직접입력)';
      if (isManualInput || isOtherTrigger) {
        return (
          <td className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
            <div className="flex items-center w-full bg-white">
              <Input autoFocus value={isOtherTrigger ? '' : localValue} onChange={(e) => { setLocalValue(e.target.value); setIsManualInput(true); isManualRef.current = true; }} onBlur={() => handleCommit(localValue)} onKeyDown={(e) => { if(e.key==='Enter') handleCommit(localValue); if(e.key==='Escape') onEndEdit(); }} className="h-8 w-full text-[11px] border-none rounded-none focus-visible:ring-0 px-1 bg-transparent font-medium" placeholder="내용 입력..." />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-400 hover:text-rose-500" onClick={() => { setLocalValue(''); setIsManualInput(false); isManualRef.current = false; }}><X className="h-3 w-3" /></Button>
            </div>
          </td>
        )
      }
      return (
        <td className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
          <Select value={isInOptions ? localValue : ''} onValueChange={(v) => { if (v === '기타(직접입력)') { isManualRef.current = true; setIsManualInput(true); setLocalValue('기타(직접입력)'); } else { handleCommit(v); } }} onOpenChange={(open) => { if (!open) { setTimeout(() => { if (!isManualRef.current) onEndEdit(); }, 50); } }} defaultOpen={true}>
            <SelectTrigger className="h-8 w-full border-none shadow-none focus:ring-0 text-[11px] px-1 bg-transparent font-medium"><SelectValue placeholder="선택..." /></SelectTrigger>
            <SelectContent className="z-[100]">{resolvedOptions?.map((opt:any) => (<SelectItem key={opt.value} value={opt.value} className="text-[11px]">{opt.label}</SelectItem>))}</SelectContent>
          </Select>
        </td>
      )
    }
    if (config.type === 'date') return (
      <td className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
        <Popover open={true} onOpenChange={(open) => !open && onEndEdit()}>
          <PopoverTrigger asChild><div className="h-8 w-full flex items-center justify-center text-[11px] cursor-pointer font-medium">{localValue || '-'}</div></PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={localValue ? new Date(localValue) : undefined} onSelect={(date) => date && handleCommit(format(date, 'yyyy-MM-dd'))} locale={ko} initialFocus /></PopoverContent>
        </Popover>
      </td>
    )
    if (config.type === 'multi-select') return <td className="p-0 border-r border-b relative z-40 bg-white" />;
    return (
      <td className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
        <Input autoFocus value={localValue} onChange={(e) => setLocalValue(e.target.value)} onBlur={() => handleCommit(localValue)} onKeyDown={(e) => { if(e.key==='Enter') handleCommit(localValue); if(e.key==='Escape') onEndEdit(); }} className="h-8 w-full text-[11px] border-none rounded-none focus-visible:ring-0 px-1 bg-transparent font-medium" />
      </td>
    )
  }

  return (
    <td 
      className={cn("p-0 border-r border-b relative h-8 transition-none select-none cursor-cell text-center overflow-hidden", isSelected && "bg-blue-50/70", isFocused && "ring-2 ring-blue-500 ring-inset z-10")} 
      style={{ minWidth: config.width, width: 'auto' }}
      onMouseDown={(e) => onMouseDown(e.shiftKey)} onMouseEnter={onMouseEnter} onDoubleClick={() => !config.readOnly && config.type !== 'action' && onStartEdit()}
    >
      <div className="px-2 text-[11px] w-full h-full flex items-center justify-center whitespace-nowrap">
        {config.type === 'action' ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-blue-50 text-blue-600 font-bold hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); onAction?.(id, field); }}>상세보기</Button>
        ) : config.variant ? (
          <span className={cn("px-1.5 py-0.5 rounded-sm font-medium border text-[9px] leading-none whitespace-nowrap text-center", config.variant(value))}>{value === 'X' ? '' : (value || '')}</span>
        ) : (
          <span className="whitespace-nowrap">{Array.isArray(value) ? value.join(', ') : (value === 'X' ? '' : (value || ''))}</span>
        )}
      </div>
    </td>
  )
}, (p, n) => p.value === n.value && p.isEditing === n.isEditing && p.isSelected === n.isSelected && p.isFocused === n.isFocused);
SpreadsheetCell.displayName = 'SpreadsheetCell';

// --- 데이터 행 ---
const SpreadsheetRow = React.memo(({ row, rIdx, columns, selMinR, selMaxR, selMinC, selMaxC, selStart, editCell, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, isSelectedRow, onSelectRow, onAction }: any) => {
  const isRowInSelection = rIdx >= selMinR && rIdx <= selMaxR;
  return (
    <tr className={cn("h-8 transition-none hover:bg-slate-50/50", isSelectedRow && "bg-blue-50/30")}>
      <td className="border-r border-b w-8 p-0 bg-white"><div className="flex items-center justify-center h-8"><Checkbox checked={isSelectedRow} onCheckedChange={(val) => onSelectRow(row.id, !!val)} /></div></td>
      {columns.map((col: any, cIdx: number) => (
        <SpreadsheetCell key={col.key} id={row.id} field={col.key} value={row[col.key]} config={col} rowData={row} isSelected={isRowInSelection && cIdx >= selMinC && cIdx <= selMaxC} isFocused={selStart?.row === rIdx && selStart?.col === cIdx} isEditing={editCell?.row === rIdx && editCell?.col === cIdx} onMouseDown={(m: any) => onMouseDown(rIdx, cIdx, m)} onMouseEnter={() => onMouseEnter(rIdx, cIdx)} onStartEdit={() => onStartEdit(rIdx, cIdx)} onEndEdit={onEndEdit} onSave={onSave} onAction={onAction} />
      ))}
    </tr>
  );
}, (p, n) => {
  if (p.row !== n.row || p.isSelectedRow !== n.isSelectedRow) return false;
  const wasIn = p.rIdx >= p.selMinR && p.rIdx <= p.selMaxR;
  const isIn = n.rIdx >= n.selMinR && n.rIdx <= n.selMaxR;
  if (wasIn !== isIn || (isIn && (p.selMinC !== n.selMinC || p.selMaxC !== n.selMaxC))) return false;
  if ((p.selStart?.row === p.rIdx) !== (n.selStart?.row === n.rIdx)) return false;
  if ((p.editCell?.row === p.rIdx) !== (n.editCell?.row === n.rIdx)) return false;
  return true;
});
SpreadsheetRow.displayName = 'SpreadsheetRow';

// --- 자격증 선택 팝업 ---
const CertificatePicker = React.memo(({ isOpen, onClose, initialValues, masterCerts, onSave }: any) => {
  const [selected, setSelected] = React.useState<string[]>([])
  const [search, setSearch] = React.useState('')
  const [activeCert, setActiveCert] = React.useState<any | null>(null)
  React.useEffect(() => { if (isOpen) { setSelected(normalizeCertificates(initialValues)); setSearch(''); setActiveCert(null); } }, [isOpen, initialValues])
  const handleCertClick = (cert: any) => { if (cert.levels && cert.levels.length > 0) setActiveCert(cert); else setSelected(prev => prev.includes(cert.name) ? prev.filter(c => c !== cert.name) : [...prev, cert.name]); }
  const handleLevelSelect = (level: string) => { if (!activeCert) return; const fullName = `${activeCert.name}(${level})`; setSelected(prev => [...prev.filter(item => item !== activeCert.name && !item.startsWith(`${activeCert.name}(`)), fullName]); setActiveCert(null); }
  const filtered = (masterCerts || []).filter((c:any) => c.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[500px] p-0 overflow-hidden rounded-2xl sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col border-none">
        <DialogHeader className="p-5 sm:p-6 bg-indigo-600 text-white shrink-0"><DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2"><Award className="h-5 w-5" /> 자격증 선택</DialogTitle><DialogDescription className="text-indigo-100 text-[10px] sm:text-xs">보유하신 자격증을 선택하세요.</DialogDescription></DialogHeader>
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-2"><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">현재 선택됨 ({selected.length})</h4><div className="flex flex-wrap gap-1.5 p-3 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50 min-h-[60px] max-h-[120px] overflow-y-auto">{selected.length > 0 ? selected.map(s => <Badge key={s} className="bg-white border-indigo-200 text-indigo-700 py-1 pl-2 pr-1 gap-1 shadow-sm"><span>{s}</span><X className="h-3.5 w-3.5 cursor-pointer text-indigo-300 hover:text-rose-500" onClick={() => setSelected(p=>p.filter(x=>x!==s))} /></Badge>) : <p className="text-xs text-slate-400 italic w-full text-center py-2">선택된 자격증이 없습니다.</p>}</div></div>
          {!activeCert ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="자격증 검색..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-10 border-slate-200 rounded-lg" /></div><div className="grid grid-cols-1 xs:grid-cols-2 gap-2">{filtered.map((c: any) => { const isAnyLevelSelected = selected.some(s => s === c.name || s.startsWith(`${c.name}(`)); return (<Button key={c.name} variant="outline" size="sm" className={cn("justify-between font-medium group px-3 h-11 rounded-lg", isAnyLevelSelected && "bg-indigo-50 border-indigo-200 text-indigo-700")} onClick={() => handleCertClick(c)}><span className="truncate text-xs">{c.name}</span>{c.levels?.length > 0 ? <ChevronRight className="h-3 w-3 text-slate-300" /> : (isAnyLevelSelected && <Check className="h-3 w-3 text-indigo-500" />)}</Button>)})}</div></div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200"><div className="flex items-center gap-2 mb-2"><Button variant="ghost" size="sm" onClick={() => setActiveCert(null)} className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></Button><h3 className="font-bold text-slate-800">{activeCert.name} <span className="text-indigo-600 text-sm">등급 선택</span></h3></div><div className="grid grid-cols-2 gap-2">{activeCert.levels.map((level: string) => (<Button key={level} variant="outline" className="h-12 text-sm font-bold border-2 rounded-xl" onClick={() => handleLevelSelect(level)}>{level}</Button>))}</div></div>
          )}
        </div>
        <DialogFooter className="p-4 bg-slate-50 border-t shrink-0"><Button variant="ghost" onClick={onClose} className="h-11">취소</Button><Button onClick={() => onSave(selected)} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 h-11 shadow-lg shadow-indigo-100">저장하기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
});
CertificatePicker.displayName = 'CertificatePicker';

// --- 모바일 상세 모달 ---
const MobileDetailModal = ({ isOpen, onClose, data, columns, onSave, onAction }: any) => {
  if (!data) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-[500px] border-none rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-indigo-600 text-white shrink-0"><DialogTitle className="text-xl font-bold flex items-center gap-2"><UserPlus className="h-5 w-5" /> 상세 정보 및 관리</DialogTitle><DialogDescription className="text-indigo-100 text-[10px]">{data.student_name || data.name} 학생 관리</DialogDescription></DialogHeader>
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="space-y-2">{columns.filter((c:any) => c.type === 'action').map((col: any) => (<Button key={col.key} variant="outline" className={cn("w-full h-14 border-indigo-100 bg-white font-bold flex justify-between px-4 group hover:bg-indigo-100 shadow-sm rounded-xl", col.key === 'field_training_action' ? "text-emerald-700 border-emerald-100 hover:bg-emerald-50" : "text-indigo-700")} onClick={() => { onClose(); onAction?.(data.id, col.key); }}><div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg transition-colors", col.key === 'field_training_action' ? "bg-emerald-100 group-hover:bg-emerald-200" : "bg-indigo-100 group-hover:bg-indigo-200")}>{col.key === 'field_training_action' ? <Award className="h-5 w-5 text-emerald-600" /> : <BookUser className="h-5 w-5 text-indigo-600" />}</div><span className="text-base">{col.label} 열기</span></div><ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" /></Button>))}</div>
          <div className="grid grid-cols-1 gap-3">{columns.filter((c:any)=>c.type!=='action').map((col: any) => {
            const resolvedOptions = typeof col.options === 'function' ? col.options(data) : col.options;
            return (
              <div key={col.key} className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col.label}</label>
                {col.readOnly ? (
                  <div className="text-sm font-semibold text-slate-700 h-10 flex items-center px-1">{data[col.key] || '-'}</div>
                ) : col.type === 'multi-select' ? (
                  <div className="flex flex-wrap gap-1 p-2 border border-slate-200 rounded-md bg-white min-h-10 items-center">{normalizeCertificates(data[col.key]).map((cert, i) => (<Badge key={i} variant="secondary" className="text-[10px] bg-slate-100">{cert}</Badge>))}<Button variant="ghost" size="sm" className="h-7 ml-auto text-indigo-600 font-bold hover:bg-indigo-50" onClick={() => onSave(data.id, col.key, 'OPEN_PICKER')}>수정하기</Button></div>
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
                      <Select value={isInOptions ? data[col.key] : ''} onValueChange={(v) => { if (v === '기타(직접입력)') onSave(data.id, col.key, '기타(직접입력)'); else onSave(data.id, col.key, v); }}><SelectTrigger className="h-10 w-full bg-white"><SelectValue placeholder="선택..." /></SelectTrigger><SelectContent><SelectItem value="CLEARED" className="text-rose-500 font-bold">선택 취소 (비우기)</SelectItem>{resolvedOptions?.map((o: any) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                    );
                  })()
                ) : col.type === 'date' ? (
                  <div className="flex gap-1"><Popover><PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-start text-sm h-10 font-medium">{data[col.key] || '날짜 선택...'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={data[col.key] ? new Date(data[col.key]) : undefined} onSelect={(date) => date && onSave(data.id, col.key, format(date, 'yyyy-MM-dd'))} locale={ko} /></PopoverContent></Popover>{data[col.key] && (<Button variant="outline" size="icon" className="h-10 w-10 shrink-0 text-slate-400 hover:text-rose-500" onClick={() => onSave(data.id, col.key, '')}><X className="h-4 w-4" /></Button>)}</div>
                ) : (
                  <div className="relative"><Input value={data[col.key] || ''} onChange={(e) => onSave(data.id, col.key, e.target.value)} className="h-10 w-full bg-white pr-10 font-medium" />{data[col.key] && (<button onClick={() => onSave(data.id, col.key, '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"><X className="h-4 w-4" /></button>)}</div>
                )}
              </div>
            );
          })}</div>
        </div>
        <DialogFooter className="p-4 bg-white border-t shrink-0"><Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 font-bold text-lg rounded-xl">창 닫기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- 메인 테이블 컴포넌트 ---
export function StandardSpreadsheetTable({ data: initialData, columns, onSave, onBulkSave, onPromote, onDelete, onAction, selectedRowIds: externalSelectedRowIds, onSelectionChange, groupHeaders, searchPlaceholder = "검색...", masterCertificates = [] }: SpreadsheetTableProps) {
  const isMobile = useIsMobile(); const router = useRouter(); const [data, setData] = React.useState(initialData); const { toast } = useToast();
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string[]>>({}); const [searchTerm, setSearchTerm] = React.useState('');
  const [selectionStart, setSelectionStart] = React.useState<any>(null); const [selectionEnd, setSelectionEnd] = React.useState<any>(null);
  const [editingCell, setEditingCell] = React.useState<any>(null); const [internalSelectedRowIds, setInternalSelectedRowIds] = React.useState<string[]>([]);
  const [scrollTop, setScrollTop] = React.useState(0); const [containerHeight, setContainerHeight] = React.useState(800);
  const containerRef = React.useRef<HTMLDivElement>(null); const isSelectingRef = React.useRef(false); 
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [detailData, setDetailData] = React.useState<any>(null);
  const ROW_HEIGHT = 32; const HEADER_HEIGHT = groupHeaders ? 80 : 40;
  
  // --- Undo/Redo 로직 ---
  const [history, setHistory] = React.useState<{id: string, field: string, oldValue: any}[]>([]);
  const [redoStack, setRedoStack] = React.useState<{id: string, field: string, newValue: any}[]>([]);
  const isSyncingRef = React.useRef(false);

  const recordHistory = React.useCallback((updates: {id: string, field: string, oldValue: any}[]) => { 
    if (isSyncingRef.current) return;
    setHistory(prev => [updates, ...prev].slice(0, 20) as any); 
    setRedoStack([]); 
  }, []);

  const handleUndo = React.useCallback(async () => { 
    if (history.length === 0 || isSyncingRef.current) return; 
    isSyncingRef.current = true;
    const lastChanges = history[0] as any; 
    const newHistory = history.slice(1); 
    const newData = [...data]; 
    const serverUpdates: any[] = []; 
    const redoUpdates: any[] = [];
    lastChanges.forEach((change: any) => { 
      const dIdx = newData.findIndex(s => s.id === change.id); 
      if (dIdx !== -1) { 
        redoUpdates.push({ id: change.id, field: change.field, newValue: newData[dIdx][change.field] });
        newData[dIdx] = { ...newData[dIdx], [change.field]: change.oldValue }; 
        serverUpdates.push({ id: change.id, field: change.field, value: change.oldValue }); 
      } 
    }); 
    setData(newData); setHistory(newHistory); setRedoStack(prev => [redoUpdates, ...prev].slice(0, 20) as any);
    const result = await onBulkSave(serverUpdates); 
    if (result.success) { toast({ title: '실행 취소 완료' }); router.refresh(); }
    setTimeout(() => { isSyncingRef.current = false; }, 500);
  }, [history, data, onBulkSave, toast, router]);

  const handleRedo = React.useCallback(async () => {
    if (redoStack.length === 0 || isSyncingRef.current) return;
    isSyncingRef.current = true;
    const lastRedo = redoStack[0] as any;
    const newRedoStack = redoStack.slice(1);
    const newData = [...data];
    const serverUpdates: any[] = [];
    const undoUpdates: any[] = [];
    lastRedo.forEach((change: any) => {
      const dIdx = newData.findIndex(s => s.id === change.id);
      if (dIdx !== -1) {
        undoUpdates.push({ id: change.id, field: change.field, oldValue: newData[dIdx][change.field] });
        newData[dIdx] = { ...newData[dIdx], [change.field]: change.newValue };
        serverUpdates.push({ id: change.id, field: change.field, value: change.newValue });
      }
    });
    setData(newData); setRedoStack(newRedoStack); setHistory(prev => [undoUpdates, ...prev].slice(0, 20) as any);
    const result = await onBulkSave(serverUpdates);
    if (result.success) { toast({ title: '다시 실행 완료' }); router.refresh(); }
    setTimeout(() => { isSyncingRef.current = false; }, 500);
  }, [redoStack, data, onBulkSave, toast, router]);

  React.useEffect(() => { if (!isSyncingRef.current) { setData(initialData); } }, [initialData]);
  React.useEffect(() => { setInternalSelectedRowIds([]); setSelectionStart(null); setSelectionEnd(null); }, [initialData]);
  
  const filterOptions = React.useMemo(() => { const opts: Record<string, Set<any>> = {}; columns.forEach(c => opts[c.key] = new Set()); initialData.forEach(s => columns.forEach(c => { const val = s[c.key]; if (val === null || val === undefined || val === '') { opts[c.key].add('(빈칸)'); } else { opts[c.key].add(String(val)); } })); const result: Record<string, any[]> = {}; Object.keys(opts).forEach(k => result[k] = Array.from(opts[k]).sort((a, b) => { if (a === '(빈칸)') return -1; if (b === '(빈칸)') return 1; return a.localeCompare(b, 'ko'); })); return result; }, [initialData, columns]);
  const filteredData = React.useMemo(() => data.filter(row => { const mF = Object.entries(columnFilters).every(([f, v]) => { if (!v?.length) return true; const rowVal = row[f]; const nV = (rowVal === null || rowVal === undefined || rowVal === '') ? '(빈칸)' : String(rowVal); return v.includes(nV); }); const mS = !searchTerm || columns.some(c => String(row[c.key] || '').toLowerCase().includes(searchTerm.toLowerCase())); return mF && mS; }), [data, columnFilters, searchTerm, columns]);

  React.useEffect(() => { setSelectionStart(null); setSelectionEnd(null); if (containerRef.current) { const maxScroll = Math.max(0, filteredData.length * ROW_HEIGHT + HEADER_HEIGHT - containerHeight); if (containerRef.current.scrollTop > maxScroll) containerRef.current.scrollTop = 0; } }, [columnFilters, searchTerm, filteredData.length, containerHeight, HEADER_HEIGHT]);
  React.useEffect(() => { if (!containerRef.current) return; const observer = new ResizeObserver((e) => { for (let entry of e) setContainerHeight(entry.contentRect.height); }); observer.observe(containerRef.current); return () => observer.disconnect(); }, []);
  React.useEffect(() => { const stop = () => { isSelectingRef.current = false }; window.addEventListener('mouseup', stop); window.addEventListener('pointerup', stop); return () => { window.removeEventListener('mouseup', stop); window.removeEventListener('pointerup', stop); }; }, []);
  
  const selectedRowIds = externalSelectedRowIds || internalSelectedRowIds;
  const syncSelected = React.useCallback((ids: any) => onSelectionChange ? onSelectionChange(ids) : setInternalSelectedRowIds(ids), [onSelectionChange]);
  const handleSelectAll = React.useCallback((checked: any) => syncSelected(checked ? filteredData.map(r => r.id) : []), [filteredData, syncSelected]);
  
  const handleMouseDown = React.useCallback((row: any, col: any, multi: any) => { isSelectingRef.current = true; setEditingCell(null); if (multi && selectionStart) setSelectionEnd({ row, col }); else { setSelectionStart({ row, col }); setSelectionEnd({ row, col }); } if (containerRef.current) containerRef.current.focus({ preventScroll: true }); }, [selectionStart]);
  const handleMouseEnter = React.useCallback((row: any, col: any) => { if (isSelectingRef.current) setSelectionEnd({ row, col }); }, []);
  const handleCopy = React.useCallback(async () => { if (!selectionStart || !selectionEnd) return; const minR = Math.min(selectionStart.row, selectionEnd.row), maxR = Math.max(selectionStart.row, selectionEnd.row); const minC = Math.min(selectionStart.col, selectionEnd.col), maxC = Math.max(selectionStart.col, selectionEnd.col); let text = ""; for (let r = minR; r <= maxR; r++) { const rowData = filteredData[r]; if (!rowData) continue; const line = []; for (let c = minC; c <= maxC; c++) { const val = rowData[columns[c].key]; line.push(Array.isArray(val) ? val.join(', ') : (val || '')); } text += line.join('\t') + (r === maxR ? "" : "\n"); } try { await navigator.clipboard.writeText(text); toast({ title: '복사 완료' }); } catch (err) { toast({ variant: 'destructive', title: '복사 실패' }); } }, [selectionStart, selectionEnd, filteredData, columns, toast]);
  const handlePaste = React.useCallback(async () => { if (!selectionStart) return; try { const text = await navigator.clipboard.readText(); if (!text) return; const cb = text.split(/\r?\n/).filter(line => line.length > 0).map(row => row.split('\t')); const cbH = cb.length, cbW = cb[0].length; const selEnd = selectionEnd || selectionStart; const minR = Math.min(selectionStart.row, selEnd.row), maxR = Math.max(selectionStart.row, selEnd.row), minC = Math.min(selectionStart.col, selEnd.col), maxC = Math.max(selectionStart.col, selEnd.col); const tMaxR = (selectionStart.row === selEnd.row && selectionStart.col === selEnd.col) ? minR + cbH - 1 : maxR; const tMaxC = (selectionStart.row === selEnd.row && selectionStart.col === selEnd.col) ? minC + cbW - 1 : maxC; const updates: any[] = []; const historyUpdates: any[] = []; const newData = [...data]; for (let r = minR; r <= tMaxR; r++) { const rowData = filteredData[r]; if (!rowData) continue; const dIdx = newData.findIndex(s => s.id === rowData.id); if (dIdx === -1) continue; const rO = r - minR, cbR = rO % cbH; for (let c = minC; c <= tMaxC; c++) { const config = columns[c]; if (!config || config.readOnly || config.type === 'action') continue; const cO = c - minC, cbC = cO % cbW; let val = cb[cbR][cbC]; if (val === undefined) continue; let finalVal: any = val.trim(); if (config.type === 'multi-select') finalVal = finalVal ? finalVal.split(',').map((v:any) => v.trim()) : []; if (newData[dIdx][config.key] !== finalVal) { historyUpdates.push({ id: rowData.id, field: config.key, oldValue: newData[dIdx][config.key] }); newData[dIdx] = { ...newData[dIdx], [config.key]: finalVal }; updates.push({ id: rowData.id, field: config.key, value: finalVal }); } } } if (updates.length > 0) { recordHistory(historyUpdates); setData(newData); const result = await onBulkSave(updates); if (result.success) toast({ title: '붙여넣기 완료' }); else toast({ variant: 'destructive', title: '저장 실패', description: result.error }); } } catch (err) { toast({ variant: 'destructive', title: '붙여넣기 실패' }); } }, [selectionStart, selectionEnd, filteredData, columns, data, onBulkSave, toast, recordHistory]);
  const handleDelete = React.useCallback(async () => { if (editingCell || !selectionStart || !selectionEnd) return; const minR = Math.min(selectionStart.row, selectionEnd.row), maxR = Math.max(selectionStart.row, selectionEnd.row), minC = Math.min(selectionStart.col, selectionEnd.col), maxC = Math.max(selectionStart.col, selectionEnd.col); const updates: any[] = []; const hUpdates: any[] = []; const newData = [...data]; for (let r = minR; r <= maxR; r++) { const rowData = filteredData[r]; if (!rowData) continue; const dIdx = newData.findIndex(s => s.id === rowData.id); if (dIdx === -1) continue; for (let c = minC; c <= maxC; c++) { const config = columns[c]; if (config.readOnly || config.type === 'action') continue; const emptyVal = config.key === 'certificates' ? [] : ''; if (newData[dIdx][config.key] !== emptyVal) { hUpdates.push({ id: rowData.id, field: config.key, oldValue: newData[dIdx][config.key] }); newData[dIdx] = { ...newData[dIdx], [config.key]: emptyVal }; updates.push({ id: rowData.id, field: config.key, value: emptyVal }); } } } if (updates.length > 0) { recordHistory(hUpdates); setData(newData); const result = await onBulkSave(updates); if (result.success) toast({ title: '셀 지우기 완료' }); else toast({ variant: 'destructive', title: '삭제 실패' }); } }, [editingCell, selectionStart, selectionEnd, filteredData, columns, data, onBulkSave, toast, recordHistory]);
  const handleSaveInternal = React.useCallback(async (id: any, field: any, value: any) => { 
    const rIdx = filteredData.findIndex(r => r.id === id); 
    const cIdx = columns.findIndex(c => c.key === field); 
    if (value === 'OPEN_PICKER') { 
      if (rIdx !== -1) setEditingCell({ row: rIdx, col: cIdx }); 
      setIsPickerOpen(true); 
      return { success: true }; 
    } 
    
    // 'CLEARED' 또는 빈 문자열인 경우 실제 null로 변환하여 저장
    const finalValue = (value === 'CLEARED' || value === '') ? null : value;
    
    const student = data.find(s => s.id === id); 
    if (student && student[field] !== finalValue) recordHistory([{ id, field, oldValue: student[field] }]); 
    setEditingCell(null); 
    setData(prev => prev.map(s => s.id === id ? { ...s, [field]: finalValue } : s)); 
    setDetailData((prev: any) => (prev && prev.id === id) ? { ...prev, [field]: finalValue } : prev); 
    return onSave(id, field, finalValue); 
  }, [onSave, filteredData, columns, data, recordHistory]);
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => { if (editingCell) return; if (e.ctrlKey && e.key === 'c') { e.preventDefault(); handleCopy(); return; } if (e.ctrlKey && e.key === 'v') { e.preventDefault(); handlePaste(); return; } if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); return; } if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); return; } if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDelete(); return; } let { row, col } = selectionEnd || selectionStart || { row: 0, col: 0 }; switch (e.key) { case 'ArrowUp': row = Math.max(0, row - 1); break; case 'ArrowDown': row = Math.min(filteredData.length - 1, row + 1); break; case 'ArrowLeft': col = Math.max(0, col - 1); break; case 'ArrowRight': col = Math.min(columns.length - 1, col + 1); break; case 'Enter': if (selectionStart) { const config = columns[selectionStart.col]; if (config.type === 'multi-select') { setEditingCell({row: selectionStart.row, col: selectionStart.col}); setIsPickerOpen(true); } else setEditingCell({ row: selectionStart.row, col: selectionStart.col }); } return; case 'Escape': setSelectionStart(null); setSelectionEnd(null); return; default: return; } e.preventDefault(); if (e.shiftKey) setSelectionEnd({ row, col }); else { setSelectionStart({ row, col }); setSelectionEnd({ row, col }); } if (containerRef.current) { const targetY = row * ROW_HEIGHT + HEADER_HEIGHT; const curS = containerRef.current.scrollTop; if (targetY < curS + HEADER_HEIGHT) containerRef.current.scrollTop = targetY - HEADER_HEIGHT; else if (targetY + ROW_HEIGHT > curS + containerHeight) containerRef.current.scrollTop = targetY + ROW_HEIGHT - containerHeight; } }, [editingCell, selectionStart, selectionEnd, filteredData, columns, HEADER_HEIGHT, containerHeight, handleDelete, handleCopy, handlePaste, handleUndo, handleRedo]);

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-muted/20 rounded-md border-dashed border shrink-0">
        <div className="flex items-center gap-3"><Search className="h-4 w-4 text-muted-foreground ml-2" /><Input placeholder={searchPlaceholder} className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs w-[300px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        {selectedRowIds.length > 0 && <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2"><span className="text-xs font-bold text-blue-700 mr-2">{selectedRowIds.length}명 선택됨</span>{onPromote && <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={async ()=>{const r=await onPromote(selectedRowIds); if(r.success) syncSelected([]);}}>{<GraduationCap className="h-3.5 w-3.5 mr-1.5" />}진급 설정</Button>}{onDelete && <Button size="sm" variant="destructive" className="h-8 shadow-md" onClick={async ()=>{if(confirm('정말 삭제하시겠습니까?')){const r=await onDelete(selectedRowIds); if(r.success) syncSelected([]);}}}><Trash2 className="h-3.5 w-3.5 mr-1.5" />삭제</Button>}<Button size="sm" variant="outline" className="h-8" onClick={() => syncSelected([])}>선택 취소</Button></div>}
      </div>
      {!isMobile ? (
        <div ref={containerRef} className="relative outline-none bg-white overflow-auto border rounded-md shadow-inner custom-scrollbar flex-1 focus-visible:ring-0" onScroll={(e)=>setScrollTop(e.currentTarget.scrollTop)} onKeyDown={handleKeyDown} tabIndex={0}>
          <table className="text-[11px] border-collapse table-auto min-w-max text-center relative border-none">
            <colgroup><col style={{ width: 32 }} />{columns.map((c, i) => <col key={i} style={{ minWidth: c.width }} />)}</colgroup>
            <TableHeader columns={columns} groupHeaders={groupHeaders} filterOptions={filterOptions} columnFilters={columnFilters} onFilterChange={(k:any,v:any)=>setColumnFilters(p=>v==='RESET'?{...p,[k]:[]}:{...p,[k]:p[k]?.includes(v)?p[k].filter(x=>x!==v):[...(p[k]||[]),v]})} onSelectAll={handleSelectAll} isAllSelected={filteredData.length > 0 && filteredData.every(r => selectedRowIds.includes(r.id))} />
            <tbody>
              {(() => {
                const start = Math.max(0, Math.floor((scrollTop) / ROW_HEIGHT) - 15);
                const end = Math.min(filteredData.length - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 15);
                const sMinR = selectionStart && selectionEnd ? Math.min(selectionStart.row, selectionEnd.row) : -1;
                const sMaxR = selectionStart && selectionEnd ? Math.max(selectionStart.row, selectionEnd.row) : -1;
                const sMinC = selectionStart && selectionEnd ? Math.min(selectionStart.col, selectionEnd.col) : -1;
                const sMaxC = selectionStart && selectionEnd ? Math.max(selectionStart.col, selectionEnd.col) : -1;
                const rows = []; if (start > 0) rows.push(<tr key="t" style={{ height: start * ROW_HEIGHT }}><td colSpan={columns.length + 1} className="border-none"></td></tr>);
                for (let i = start; i <= end; i++) { rows.push(<SpreadsheetRow key={filteredData[i].id} rIdx={i} row={filteredData[i]} columns={columns} selMinR={sMinR} selMaxR={sMaxR} selMinC={sMinC} selMaxC={sMaxC} selStart={selectionStart} editCell={editingCell} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} onStartEdit={(r:any,c:any)=>{ if(columns[c].type==='multi-select'){ setEditingCell({row:r,col:c}); setIsPickerOpen(true); } else setEditingCell({row:r,col:c}); }} onEndEdit={()=>setEditingCell(null)} onSave={handleSaveInternal} isSelectedRow={selectedRowIds.includes(filteredData[i].id)} onSelectRow={(id:any,v:any)=>syncSelected(v?[...selectedRowIds,id]:selectedRowIds.filter(x=>x!==id))} onAction={onAction} />); }
                if (end < filteredData.length - 1) rows.push(<tr key="b" style={{ height: (filteredData.length - 1 - end) * ROW_HEIGHT }}><td colSpan={columns.length + 1} className="border-none"></td></tr>); return rows;
              })()}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:hidden p-1 overflow-y-auto">
          {filteredData.map((row) => {
            const titleCol = columns.find(c => c.key.includes('name')) || columns[1];
            const statusCol = columns.find(c => c.key.includes('status') || c.key.includes('aspiration'));
            
            // 헤더에 이미 표시된 정보(학과, 반, 번호, 성명)와 액션/자격증을 제외한 나머지 정보 중 상위 6개 추출
            const infoCols = columns.filter(c => 
              c.key !== 'major' && 
              c.key !== 'class_info' && 
              c.key !== 'student_number' && 
              c.key !== titleCol?.key && 
              c.key !== statusCol?.key && 
              c.type !== 'action' && 
              c.key !== 'certificates'
            ).slice(0, 6);

            return (
              <div key={row.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer" onClick={() => setDetailData(row)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                      {String(row[titleCol?.key || ''] || '?')[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{row[titleCol?.key || ''] || '이름 없음'}</h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        {row.major || ''} {row.class_info ? `${row.class_info}반` : ''} {row.student_number ? `${row.student_number}번` : ''}
                      </p>
                    </div>
                  </div>
                  {statusCol && <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0", statusCol.variant?.(row[statusCol.key]))}>{row[statusCol.key] || '미설정'}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-3 border-t border-slate-50 pt-3">
                  {infoCols.map(col => (
                    <div key={col.key} className="space-y-0.5 min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{col.label}</p>
                      <p className="text-xs font-semibold text-slate-700 truncate">{row[col.key] || '-'}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-slate-400"><div className="flex gap-1 overflow-hidden">{normalizeCertificates(row?.certificates || []).slice(0, 2).map((cert, i) => (<span key={i} className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm whitespace-nowrap">{cert}</span>))}{normalizeCertificates(row?.certificates || []).length > 2 && (<span className="text-[8px] text-slate-400">+{normalizeCertificates(row?.certificates || []).length - 2}</span>)}</div><ChevronRight className="h-4 w-4" /></div></div>);
          })}
          {filteredData.length === 0 && <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><p className="text-sm text-slate-400">검색 결과가 없습니다.</p></div>}
        </div>
      )}
      <CertificatePicker isOpen={isPickerOpen} onClose={() => { setIsPickerOpen(false); setEditingCell(null); }} initialValues={editingCell ? (filteredData[editingCell.row]?.certificates || []) : []} masterCerts={masterCertificates} onSave={(vals: any) => { if(editingCell) handleSaveInternal(filteredData[editingCell.row]?.id, 'certificates', vals); setIsPickerOpen(false); }} />
      <MobileDetailModal isOpen={!!detailData} onClose={()=>setDetailData(null)} data={detailData} columns={columns} onSave={handleSaveInternal} onAction={onAction} />
    </div>
  );
}
