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

export interface ColumnConfig {
  key: string
  label: string
  width: number
  type?: 'text' | 'select' | 'date' | 'multi-select' | 'action'
  options?: { label: string; value: string }[]
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

// --- 메모이제이션 및 상단 고정 헤더 ---
const TableHeader = React.memo(({ columns, groupHeaders, filterOptions, columnFilters, onFilterChange, onSelectAll, isAllSelected }: any) => {
  const hasGroup = !!groupHeaders;
  return (
    <thead className="text-muted-foreground select-none relative z-30">
      {groupHeaders && (
        <tr className="h-10">
          <th className="sticky top-0 z-40 border-r border-b w-8 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]"></th>
          {groupHeaders.map((h: any, i: number) => (
            <th 
              key={i} 
              colSpan={h.colSpan} 
              className={cn(
                "sticky top-0 z-40 text-center border-r border-b font-bold p-0 text-[10px] bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", 
                h.className
              )}
            >
              {h.label}
            </th>
          ))}
        </tr>
      )}
      <tr className="h-10">
        <th className={cn("sticky z-40 border-r border-b w-8 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", hasGroup ? "top-10" : "top-0")}>
          <div className="flex items-center justify-center h-10">
            <Checkbox checked={isAllSelected} onCheckedChange={onSelectAll} />
          </div>
        </th>
        {columns.map((col: any) => (
          <th 
            key={col.key} 
            className={cn(
              "sticky z-40 group text-center border-r border-b font-semibold p-0 hover:bg-slate-100 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", 
              hasGroup ? "top-10" : "top-0"
            )} 
            style={{ width: col.width }}
          >
            <div className="flex items-center justify-center px-1 gap-1 h-full">
              <span className="truncate">{col.label}</span>
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
}, (p, n) => {
  return p.columnFilters === n.columnFilters && 
         p.isAllSelected === n.isAllSelected && 
         p.columns === n.columns &&
         p.onSelectAll === n.onSelectAll;
});

// --- 셀 컴포넌트 ---
const SpreadsheetCell = React.memo(({ id, field, value, config, isEditing, isSelected, isFocused, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, onAction }: any) => {
  const [localValue, setLocalValue] = React.useState(value || '')
  React.useEffect(() => { if (isEditing) setLocalValue(value || '') }, [value, isEditing])
  const handleCommit = React.useCallback((v: any) => { if (v !== value) onSave(id, field, v); onEndEdit(); }, [id, field, value, onSave, onEndEdit]);

  if (isEditing) {
    if (config.type === 'select') return (
      <td className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
        <Select open={true} value={config.options?.some((o:any)=>o.value === localValue) ? localValue : ''} onValueChange={handleCommit} onOpenChange={(open) => !open && onEndEdit()}>
          <SelectTrigger className="h-8 w-full border-none shadow-none focus:ring-0 text-[11px] px-1 bg-transparent font-medium"><SelectValue placeholder="선택..." /></SelectTrigger>
          <SelectContent>{config.options?.map((opt:any) => (<SelectItem key={opt.value} value={opt.value} className="text-[11px]">{opt.label}</SelectItem>))}</SelectContent>
        </Select>
      </td>
    )
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
      style={{ width: config.width }}
      onMouseDown={(e) => onMouseDown(e.shiftKey)} onMouseEnter={onMouseEnter} onDoubleClick={() => !config.readOnly && config.type !== 'action' && onStartEdit()}
    >
      <div className="px-1 truncate text-[11px] w-full h-full flex items-center justify-center">
        {config.type === 'action' ? <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-blue-50 text-blue-600 font-bold hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); onAction?.(id, field); }}>상세보기</Button> : (config.variant ? <span className={cn("px-1.5 py-0.5 rounded-sm font-medium border text-[9px] leading-none", config.variant(value))}>{value || ''}</span> : <span>{Array.isArray(value) ? value.join(', ') : (value || '')}</span>)}
      </div>
    </td>
  )
}, (p, n) => p.value === n.value && p.isEditing === n.isEditing && p.isSelected === n.isSelected && p.isFocused === n.isFocused);

// --- 행 컴포넌트 ---
const SpreadsheetRow = React.memo(({ row, rIdx, columns, selMinR, selMaxR, selMinC, selMaxC, selStart, editCell, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, isSelectedRow, onSelectRow, onAction }: any) => {
  const isRowInSelection = rIdx >= selMinR && rIdx <= selMaxR;
  return (
    <tr className={cn("h-8 transition-none hover:bg-slate-50/50", isSelectedRow && "bg-blue-50/30")}>
      <td className="border-r border-b w-8 p-0 bg-white"><div className="flex items-center justify-center h-8"><Checkbox checked={isSelectedRow} onCheckedChange={(val) => onSelectRow(row.id, !!val)} /></div></td>
      {columns.map((col: any, cIdx: number) => (
        <SpreadsheetCell key={col.key} id={row.id} field={col.key} value={row[col.key]} config={col} isSelected={isRowInSelection && cIdx >= selMinC && cIdx <= selMaxC} isFocused={selStart?.row === rIdx && selStart?.col === cIdx} isEditing={editCell?.row === rIdx && editCell?.col === cIdx} onMouseDown={(m: any) => onMouseDown(rIdx, cIdx, m)} onMouseEnter={() => onMouseEnter(rIdx, cIdx)} onStartEdit={() => onStartEdit(rIdx, cIdx)} onEndEdit={onEndEdit} onSave={onSave} onAction={onAction} />
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

// --- 자격증 및 급수 선택 모달 ---
const CertificatePicker = React.memo(({ isOpen, onClose, initialValues, masterCerts, onSave }: any) => {
  const [selected, setSelected] = React.useState<string[]>([])
  const [search, setSearch] = React.useState('')
  const [activeCert, setActiveCert] = React.useState<any | null>(null)

  React.useEffect(() => { 
    if (isOpen) { 
      setSelected(normalizeCertificates(initialValues))
      setSearch('')
      setActiveCert(null)
    } 
  }, [isOpen, initialValues])

  const handleCertClick = (cert: any) => {
    if (cert.levels && cert.levels.length > 0) setActiveCert(cert)
    else setSelected(prev => prev.includes(cert.name) ? prev.filter(c => c !== cert.name) : [...prev, cert.name])
  }

  const handleLevelSelect = (level: string) => {
    if (!activeCert) return
    const fullName = `${activeCert.name}(${level})`
    const baseName = activeCert.name
    setSelected(prev => {
      const filtered = prev.filter(item => item !== baseName && !item.startsWith(`${baseName}(`))
      return [...filtered, fullName]
    })
    setActiveCert(null)
  }

  const filtered = (masterCerts || []).filter((c:any) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[500px] p-0 overflow-hidden rounded-2xl sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col border-none">
        <DialogHeader className="p-5 sm:p-6 bg-indigo-600 text-white shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2"><Award className="h-5 w-5" /> 자격증 선택</DialogTitle>
          <DialogDescription className="text-indigo-100 text-[10px] sm:text-xs">보유하신 자격증을 선택하세요. 급수가 있는 경우 등급창이 나타납니다.</DialogDescription>
        </DialogHeader>
        
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">현재 선택됨 ({selected.length})</h4>
            <div className="flex flex-wrap gap-1.5 p-3 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50 min-h-[60px] max-h-[120px] overflow-y-auto">
              {selected.length > 0 ? selected.map(s => <Badge key={s} className="bg-white border-indigo-200 text-indigo-700 py-1 pl-2 pr-1 gap-1 shadow-sm"><span>{s}</span><X className="h-3.5 w-3.5 cursor-pointer text-indigo-300 hover:text-rose-500" onClick={() => setSelected(p=>p.filter(x=>x!==s))} /></Badge>) : <p className="text-xs text-slate-400 italic w-full text-center py-2">선택된 자격증이 없습니다.</p>}
            </div>
          </div>

          {!activeCert ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="자격증 검색..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-10 border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                {filtered.map((c: any) => {
                  const isAnyLevelSelected = selected.some(s => s === c.name || s.startsWith(`${c.name}(`))
                  return (
                    <Button key={c.name} variant="outline" size="sm" className={cn("justify-between font-medium group px-3 h-11 rounded-lg", isAnyLevelSelected && "bg-indigo-50 border-indigo-200 text-indigo-700")} onClick={() => handleCertClick(c)}>
                      <span className="truncate text-xs">{c.name}</span>
                      {c.levels?.length > 0 ? <ChevronRight className="h-3 w-3 text-slate-300" /> : (isAnyLevelSelected && <Check className="h-3 w-3 text-indigo-500" />)}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={() => setActiveCert(null)} className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></Button>
                <h3 className="font-bold text-slate-800">{activeCert.name} <span className="text-indigo-600 text-sm">등급 선택</span></h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activeCert.levels.map((level: string) => (
                  <Button key={level} variant="outline" className="h-12 text-sm font-bold border-2 rounded-xl" onClick={() => handleLevelSelect(level)}>{level}</Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="p-4 bg-slate-50 border-t shrink-0"><Button variant="ghost" onClick={onClose} className="h-11">취소</Button><Button onClick={() => onSave(selected)} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 h-11 shadow-lg shadow-indigo-100">저장하기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

// --- 모바일용 상세 정보 모달 ---
const MobileDetailModal = ({ isOpen, onClose, data, columns, onSave, onAction }: any) => {
  if (!data) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-[500px] border-none rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-indigo-600 text-white shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2"><UserPlus className="h-5 w-5" /> 상세 정보 및 관리</DialogTitle>
          <DialogDescription className="text-indigo-100 text-[10px]">{data.student_name || data.name} 학생의 학적 및 상담 기록을 관리합니다.</DialogDescription>
        </DialogHeader>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="space-y-2">
            {columns.filter((c:any) => c.type === 'action').map((col: any) => (
              <Button key={col.key} variant="outline" className="w-full h-14 border-indigo-100 bg-white text-indigo-700 font-bold flex justify-between px-4 group hover:bg-indigo-100 shadow-sm rounded-xl" onClick={() => { onClose(); onAction?.(data.id, col.key); }}>
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-lg group-hover:bg-indigo-200 transition-colors"><BookUser className="h-5 w-5 text-indigo-600" /></div>
                  <span className="text-base">{col.label} 열기</span>
                </div>
                <ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {columns.filter((c:any)=>c.type!=='action').map((col: any) => (
              <div key={col.key} className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col.label}</label>
                {col.readOnly ? (
                  <div className="text-sm font-semibold text-slate-700 h-10 flex items-center px-1">{data[col.key] || '-'}</div>
                ) : col.type === 'multi-select' ? (
                  <div className="flex flex-wrap gap-1 p-2 border border-slate-200 rounded-md bg-white min-h-10 items-center">
                    {normalizeCertificates(data[col.key]).map((cert, i) => (<Badge key={i} variant="secondary" className="text-[10px] bg-slate-100">{cert}</Badge>))}
                    <Button variant="ghost" size="sm" className="h-7 ml-auto text-indigo-600 font-bold hover:bg-indigo-50" onClick={() => onSave(data.id, col.key, 'OPEN_PICKER')}>수정하기</Button>
                  </div>
                ) : col.type === 'select' ? (
                  <Select value={col.options?.some((o:any)=>o.value===data[col.key])?data[col.key]:''} onValueChange={(v)=>onSave(data.id,col.key,v)}>
                    <SelectTrigger className="h-10 w-full bg-white"><SelectValue placeholder="선택..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLEARED" className="text-rose-500 font-bold">선택 취소 (비우기)</SelectItem>
                      {col.options?.map((o:any)=>(<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                ) : col.type === 'date' ? (
                  <div className="flex gap-1">
                    <Popover>
                      <PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-start text-sm h-10 font-medium">{data[col.key] || '날짜 선택...'}</Button></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={data[col.key] ? new Date(data[col.key]) : undefined} onSelect={(date) => date && onSave(data.id, col.key, format(date, 'yyyy-MM-dd'))} locale={ko} /></PopoverContent>
                    </Popover>
                    {data[col.key] && (
                      <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 text-slate-400 hover:text-rose-500" onClick={() => onSave(data.id, col.key, '')}><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Input 
                      key={data.id + col.key + data[col.key]} // 데이터 변경 시 리렌더링 강제
                      defaultValue={data[col.key] || ''} 
                      onBlur={(e) => { if(e.target.value!==data[col.key]) onSave(data.id, col.key, e.target.value) }} 
                      className="h-10 w-full bg-white pr-10 font-medium" 
                    />
                    {data[col.key] && (
                      <button 
                        onClick={() => onSave(data.id, col.key, '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="p-4 bg-white border-t shrink-0"><Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 font-bold text-lg rounded-xl">창 닫기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- 메인 테이블 컴포넌트 ---
export function StandardSpreadsheetTable({ data: initialData, columns, onSave, onBulkSave, onPromote, onDelete, onAction, selectedRowIds: externalSelectedRowIds, onSelectionChange, groupHeaders, searchPlaceholder = "검색...", masterCertificates = [] }: SpreadsheetTableProps) {
  const isMobile = useIsMobile(); const [data, setData] = React.useState(initialData); const { toast } = useToast();
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string[]>>({}); const [searchTerm, setSearchTerm] = React.useState('');
  const [selectionStart, setSelectionStart] = React.useState<any>(null); const [selectionEnd, setSelectionEnd] = React.useState<any>(null);
  const [editingCell, setEditingCell] = React.useState<any>(null); const [internalSelectedRowIds, setInternalSelectedRowIds] = React.useState<string[]>([]);
  const [scrollTop, setScrollTop] = React.useState(0); const [containerHeight, setContainerHeight] = React.useState(800);
  const containerRef = React.useRef<HTMLDivElement>(null); const isSelectingRef = React.useRef(false); const [isPromoting, setIsPromoting] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false); const [detailData, setDetailData] = React.useState<any>(null);
  const ROW_HEIGHT = 32; const HEADER_HEIGHT = groupHeaders ? 80 : 40;
  
  // --- Undo(실행 취소)를 위한 상태 ---
  const [history, setHistory] = React.useState<{id: string, field: string, oldValue: any}[]>([]);

  const recordHistory = React.useCallback((updates: {id: string, field: string, oldValue: any}[]) => {
    setHistory(prev => [updates, ...prev].slice(0, 20) as any); // 최대 20단계
  }, []);

  const handleUndo = React.useCallback(async () => {
    if (history.length === 0) return;
    
    const lastChanges = history[0] as any;
    const newHistory = history.slice(1);
    
    const newData = [...data];
    const serverUpdates: any[] = [];
    
    lastChanges.forEach((change: any) => {
      const dIdx = newData.findIndex(s => s.id === change.id);
      if (dIdx !== -1) {
        newData[dIdx] = { ...newData[dIdx], [change.field]: change.oldValue };
        serverUpdates.push({ id: change.id, field: change.field, value: change.oldValue });
      }
    });
    
    setData(newData);
    setHistory(newHistory);
    
    const result = await onBulkSave(serverUpdates);
    if (result.success) {
      toast({ title: '실행 취소 완료', description: '이전 상태로 되돌렸습니다.' });
    } else {
      toast({ variant: 'destructive', title: '복구 실패', description: result.error });
    }
  }, [history, data, onBulkSave, toast]);

  React.useEffect(() => { 
    setData(initialData);
    // 서버 데이터가 변경되면 선택 상태 초기화
    setInternalSelectedRowIds([]);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [initialData]);

  const filterOptions = React.useMemo(() => {
    const opts: Record<string, Set<any>> = {}; columns.forEach(c => opts[c.key] = new Set());
    initialData.forEach(s => columns.forEach(c => { if(s[c.key]) opts[c.key].add(s[c.key]); }));
    const result: Record<string, any[]> = {}; Object.keys(opts).forEach(k => result[k] = Array.from(opts[k]).sort()); return result;
  }, [initialData, columns]);

  const filteredData = React.useMemo(() => data.filter(row => {
    const mF = Object.entries(columnFilters).every(([f, v]) => !v?.length || v.includes(String(row[f] || '')));
    const mS = !searchTerm || columns.some(c => String(row[c.key] || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return mF && mS;
  }), [data, columnFilters, searchTerm, columns]);

  // 로컬 필터(헤더 필터, 검색) 변경 시 선택 상태 초기화 및 스크롤 조정
  React.useEffect(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
    
    // 필터로 인해 데이터가 줄어들었을 때 스크롤 위치가 범위를 벗어나지 않도록 조정
    if (containerRef.current) {
      const maxScroll = Math.max(0, filteredData.length * ROW_HEIGHT + HEADER_HEIGHT - containerHeight);
      if (containerRef.current.scrollTop > maxScroll) {
        containerRef.current.scrollTop = 0; // 혹은 maxScroll로 조정
      }
    }
  }, [columnFilters, searchTerm, filteredData.length]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => { for (let entry of entries) setContainerHeight(entry.contentRect.height); });
    observer.observe(containerRef.current); return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const stop = () => { isSelectingRef.current = false };
    window.addEventListener('mouseup', stop); window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('mouseup', stop); window.removeEventListener('pointerup', stop); };
  }, []);

  const selectedRowIds = externalSelectedRowIds || internalSelectedRowIds;
  const syncSelected = React.useCallback((ids: any) => onSelectionChange ? onSelectionChange(ids) : setInternalSelectedRowIds(ids), [onSelectionChange]);

  const handleSelectAll = React.useCallback((checked: any) => {
    syncSelected(checked ? filteredData.map(r => r.id) : []);
  }, [filteredData, syncSelected]);

  const handleMouseDown = React.useCallback((row: any, col: any, multi: any) => { 
    isSelectingRef.current = true; setEditingCell(null); 
    if (multi && selectionStart) setSelectionEnd({ row, col }); 
    else { setSelectionStart({ row, col }); setSelectionEnd({ row, col }); } 
    if (containerRef.current) containerRef.current.focus({ preventScroll: true }); 
  }, [selectionStart]);

  const handleMouseEnter = React.useCallback((row: any, col: any) => { if (isSelectingRef.current) requestAnimationFrame(() => setSelectionEnd({ row, col })); }, []);
  
  // --- 핵심: 복사/붙여넣기 로직 ---
  const handleCopy = React.useCallback(async () => {
    if (!selectionStart || !selectionEnd) return
    
    const minR = Math.min(selectionStart.row, selectionEnd.row), maxR = Math.max(selectionStart.row, selectionEnd.row)
    const minC = Math.min(selectionStart.col, selectionEnd.col), maxC = Math.max(selectionStart.col, selectionEnd.col)
    
    let text = ""
    for (let r = minR; r <= maxR; r++) {
      const rowData = filteredData[r]
      if (!rowData) continue
      const line = []
      for (let c = minC; c <= maxC; c++) {
        const val = rowData[columns[c].key]
        line.push(Array.isArray(val) ? val.join(', ') : (val || ''))
      }
      text += line.join('\t') + (r === maxR ? "" : "\n")
    }
    
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: '복사 완료', description: '선택 영역이 클립보드에 복사되었습니다.' })
    } catch (err) {
      toast({ variant: 'destructive', title: '복사 실패', description: '클립보드 접근 권한이 없습니다.' })
    }
  }, [selectionStart, selectionEnd, filteredData, columns, toast]);

  const handlePaste = React.useCallback(async () => {
    if (!selectionStart) return
    
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      
      const clipboardRows = text.split(/\r?\n/).filter(line => line.length > 0).map(row => row.split('\t'))
      const cbHeight = clipboardRows.length
      const cbWidth = clipboardRows[0].length

      // 사용자가 선택한 실제 영역 계산
      const selEnd = selectionEnd || selectionStart
      const minR = Math.min(selectionStart.row, selEnd.row)
      const maxR = Math.max(selectionStart.row, selEnd.row)
      const minC = Math.min(selectionStart.col, selEnd.col)
      const maxC = Math.max(selectionStart.col, selEnd.col)

      // 붙여넣기 타겟 범위 결정 (단일 선택이면 클립보드 크기만큼, 블록 선택이면 블록 크기만큼)
      const targetMaxR = (selectionStart.row === selEnd.row && selectionStart.col === selEnd.col) 
        ? minR + cbHeight - 1 
        : maxR
      const targetMaxC = (selectionStart.row === selEnd.row && selectionStart.col === selEnd.col) 
        ? minC + cbWidth - 1 
        : maxC
      
      const updates: any[] = []
      const historyUpdates: any[] = []
      const newData = [...data]
      
      for (let r = minR; r <= targetMaxR; r++) {
        const rowData = filteredData[r]
        if (!rowData) continue
        
        const dIdx = newData.findIndex(s => s.id === rowData.id)
        if (dIdx === -1) continue

        const rOffset = r - minR
        const clipboardRIdx = rOffset % cbHeight 

        for (let c = minC; c <= targetMaxC; c++) {
          const config = columns[c]
          if (!config || config.readOnly || config.type === 'action') continue
          
          const cOffset = c - minC
          const clipboardCIdx = cOffset % cbWidth 
          
          let val = clipboardRows[clipboardRIdx][clipboardCIdx]
          if (val === undefined) continue 

          let finalVal: any = val.trim()
          if (config.type === 'multi-select') {
             finalVal = finalVal ? finalVal.split(',').map((v:any) => v.trim()) : []
          }
          
          if (newData[dIdx][config.key] !== finalVal) {
            historyUpdates.push({ id: rowData.id, field: config.key, oldValue: newData[dIdx][config.key] })
            newData[dIdx] = { ...newData[dIdx], [config.key]: finalVal }
            updates.push({ id: rowData.id, field: config.key, value: finalVal })
          }
        }
      }
      
      if (updates.length > 0) {
        recordHistory(historyUpdates)
        setData(newData)
        const result = await onBulkSave(updates)
        if (result.success) {
          toast({ title: '붙여넣기 완료', description: `${updates.length}개의 셀이 업데이트되었습니다.` })
        } else {
          toast({ variant: 'destructive', title: '저장 실패', description: result.error })
        }
      }
    } catch (err) {
      toast({ variant: 'destructive', title: '붙여넣기 실패', description: '클립보드 데이터를 읽을 수 없습니다.' })
    }
  }, [selectionStart, selectionEnd, filteredData, columns, data, onBulkSave, toast]);

  const handleDelete = React.useCallback(async () => {
    if (editingCell || !selectionStart || !selectionEnd) return
    
    const minR = Math.min(selectionStart.row, selectionEnd.row), maxR = Math.max(selectionStart.row, selectionEnd.row)
    const minC = Math.min(selectionStart.col, selectionEnd.col), maxC = Math.max(selectionStart.col, selectionEnd.col)
    
    const updates: any[] = []
    const historyUpdates: any[] = []
    const newData = [...data]
    
    for (let r = minR; r <= maxR; r++) {
      const rowData = filteredData[r]
      if (!rowData) continue
      
      const dIdx = newData.findIndex(s => s.id === rowData.id)
      if (dIdx === -1) continue

      for (let c = minC; c <= maxC; c++) {
        const config = columns[c]
        if (config.readOnly || config.type === 'action') continue
        
        const emptyVal = config.key === 'certificates' ? [] : ''
        if (newData[dIdx][config.key] !== emptyVal) {
          historyUpdates.push({ id: rowData.id, field: config.key, oldValue: newData[dIdx][config.key] })
          newData[dIdx] = { ...newData[dIdx], [config.key]: emptyVal }
          updates.push({ id: rowData.id, field: config.key, value: emptyVal })
        }
      }
    }
    
    if (updates.length > 0) {
      recordHistory(historyUpdates)
      setData(newData)
      const result = await onBulkSave(updates)
      if (result.success) toast({ title: '셀 내용 지우기 완료' })
      else toast({ variant: 'destructive', title: '삭제 실패', description: result.error })
    }
  }, [editingCell, selectionStart, selectionEnd, filteredData, columns, data, onBulkSave, toast]);

  const handleSaveInternal = React.useCallback(async (id: any, field: any, value: any) => { 
    const rIdx = filteredData.findIndex(r => r.id === id);
    const cIdx = columns.findIndex(c => c.key === field);
    
    if (value === 'OPEN_PICKER') { 
      if (rIdx !== -1) setEditingCell({ row: rIdx, col: cIdx });
      setPickerOpen(true); 
      return { success: true }; 
    }
    
    const student = data.find(s => s.id === id);
    if (student && student[field] !== value) {
      recordHistory([{ id, field, oldValue: student[field] }]);
    }

    setEditingCell(null);
    setData(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s)); return onSave(id, field, value); 
  }, [onSave, filteredData, columns, data, recordHistory]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (editingCell) return;
    
    // Ctrl + C (복사)
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      handleCopy();
      return;
    }

    // Ctrl + V (붙여넣기)
    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      handlePaste();
      return;
    }

    // Ctrl + Z (실행 취소)
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Delete/Backspace 키 처리 보강
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); // 브라우저 기본 동작 방지
      handleDelete();
      return;
    }

    let { row, col } = selectionEnd || selectionStart || { row: 0, col: 0 };
    switch (e.key) {
      case 'ArrowUp': row = Math.max(0, row - 1); break;
      case 'ArrowDown': row = Math.min(filteredData.length - 1, row + 1); break;
      case 'ArrowLeft': col = Math.max(0, col - 1); break;
      case 'ArrowRight': col = Math.min(columns.length - 1, col + 1); break;
      case 'Enter': 
        if (selectionStart) { 
          const config = columns[selectionStart.col]; 
          if (config.type === 'multi-select') { setEditingCell({row: selectionStart.row, col: selectionStart.col}); setPickerOpen(true); } 
          else setEditingCell({ row: selectionStart.row, col: selectionStart.col }); 
        } 
        return;
      case 'Escape': setSelectionStart(null); setSelectionEnd(null); return;
      default: return;
    }
    e.preventDefault();
    if (e.shiftKey) setSelectionEnd({ row, col }); else { setSelectionStart({ row, col }); setSelectionEnd({ row, col }); }
    if (containerRef.current) {
      const targetY = row * ROW_HEIGHT + HEADER_HEIGHT; const curS = containerRef.current.scrollTop;
      if (targetY < curS + HEADER_HEIGHT) containerRef.current.scrollTop = targetY - HEADER_HEIGHT;
      else if (targetY + ROW_HEIGHT > curS + containerHeight) containerRef.current.scrollTop = targetY + ROW_HEIGHT - containerHeight;
    }
  }, [editingCell, selectionStart, selectionEnd, filteredData, columns, HEADER_HEIGHT, containerHeight, handleDelete]);

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-muted/20 rounded-md border-dashed border shrink-0">
        <div className="flex items-center gap-3"><Search className="h-4 w-4 text-muted-foreground ml-2" /><Input placeholder={searchPlaceholder} className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs w-[300px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        {selectedRowIds.length > 0 && <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
          <span className="text-xs font-bold text-blue-700 mr-2">{selectedRowIds.length}명 선택됨</span>
          {onPromote && <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={async ()=>{setIsPromoting(true); const r=await onPromote(selectedRowIds); setIsPromoting(false); if(r.success) syncSelected([]);}} disabled={isPromoting}>{isPromoting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5 mr-1.5" />}진급 설정</Button>}
          {onDelete && <Button size="sm" variant="destructive" className="h-8 shadow-md" onClick={async ()=>{if(confirm('정말 삭제하시겠습니까?')){const r=await onDelete(selectedRowIds); if(r.success) syncSelected([]);}}}><Trash2 className="h-3.5 w-3.5 mr-1.5" />삭제</Button>}
          <Button size="sm" variant="outline" className="h-8" onClick={() => syncSelected([])}>선택 취소</Button>
        </div>}
      </div>

      {!isMobile ? (
        <div ref={containerRef} className="relative outline-none bg-white overflow-auto border rounded-md shadow-inner custom-scrollbar flex-1" onScroll={(e)=>setScrollTop(e.currentTarget.scrollTop)} onKeyDown={handleKeyDown} tabIndex={0}>
          <table className="text-[11px] border-collapse table-fixed min-w-max text-center relative border-none">
            <colgroup><col style={{ width: 32 }} />{columns.map((c, i) => <col key={i} style={{ width: c.width }} />)}</colgroup>
            <TableHeader columns={columns} groupHeaders={groupHeaders} filterOptions={filterOptions} columnFilters={columnFilters} onFilterChange={(k:any,v:any)=>setColumnFilters(p=>v==='RESET'?{...p,[k]:[]}:{...p,[k]:p[k]?.includes(v)?p[k].filter(x=>x!==v):[...(p[k]||[]),v]})} onSelectAll={handleSelectAll} isAllSelected={filteredData.length > 0 && filteredData.every(r => selectedRowIds.includes(r.id))} />
            <tbody>
              {(() => {
                const start = Math.max(0, Math.floor((scrollTop) / ROW_HEIGHT) - 15);
                const end = Math.min(filteredData.length - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 15);
                const sMinR = selectionStart && selectionEnd ? Math.min(selectionStart.row, selectionEnd.row) : -1;
                const sMaxR = selectionStart && selectionEnd ? Math.max(selectionStart.row, selectionEnd.row) : -1;
                const sMinC = selectionStart && selectionEnd ? Math.min(selectionStart.col, selectionEnd.col) : -1;
                const sMaxC = selectionStart && selectionEnd ? Math.max(selectionStart.col, selectionEnd.col) : -1;
                const rows = []; if (start > 0) rows.push(<tr key="t" style={{ height: start * ROW_HEIGHT }}><td colSpan={columns.length + 1}></td></tr>);
                for (let i = start; i <= end; i++) rows.push(<SpreadsheetRow key={filteredData[i].id} rIdx={i} row={filteredData[i]} columns={columns} selMinR={sMinR} selMaxR={sMaxR} selMinC={sMinC} selMaxC={sMaxC} selStart={selectionStart} editCell={editingCell} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} onStartEdit={(r:any,c:any)=>{ if(columns[c].type==='multi-select'){ setEditingCell({row:r,col:c}); setPickerOpen(true); } else setEditingCell({row:r,col:c}); }} onEndEdit={()=>setEditingCell(null)} onSave={handleSaveInternal} isSelectedRow={selectedRowIds.includes(filteredData[i].id)} onSelectRow={(id:any,v:any)=>syncSelected(v?[...selectedRowIds,id]:selectedRowIds.filter(x=>x!==id))} onAction={onAction} />);
                if (end < filteredData.length - 1) rows.push(<tr key="b" style={{ height: (filteredData.length - 1 - end) * ROW_HEIGHT }}><td colSpan={columns.length + 1}></td></tr>); return rows;
              })()}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:hidden p-1 overflow-y-auto">
          {filteredData.map((row) => {
            const titleCol = columns.find(c => c.key.includes('name')) || columns[1];
            const subTitleCol = columns.find(c => c.key.includes('number')) || columns[0];
            const statusCol = columns.find(c => c.key.includes('status') || c.key.includes('aspiration'));
            const infoCols = columns.filter(c => c.key !== titleCol?.key && c.key !== subTitleCol?.key && c.key !== statusCol?.key && c.type !== 'action' && c.key !== 'certificates').slice(0, 4);
            return (
              <div key={row.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer" onClick={() => setDetailData(row)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">{String(row[titleCol?.key || ''] || '?')[0]}</div>
                    <div className="min-w-0"><h3 className="font-bold text-slate-900 truncate">{row[titleCol?.key || ''] || '이름 없음'}</h3><p className="text-[11px] text-slate-500 truncate">{subTitleCol?.label}: {row[subTitleCol?.key || ''] || '-'}</p></div>
                  </div>
                  {statusCol && <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0", statusCol.variant?.(row[statusCol.key]))}>{row[statusCol.key] || '미설정'}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-50 pt-3">
                  {infoCols.map(col => (<div key={col.key} className="space-y-0.5 min-w-0"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{col.label}</p><p className="text-xs font-semibold text-slate-700 truncate">{row[col.key] || '-'}</p></div>))}
                </div>
                <div className="mt-3 flex items-center justify-between text-slate-400">
                  <div className="flex gap-1 overflow-hidden">{normalizeCertificates(row.certificates).slice(0, 2).map((cert, i) => (<span key={i} className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm whitespace-nowrap">{cert}</span>))}{normalizeCertificates(row.certificates).length > 2 && (<span className="text-[8px] text-slate-400">+{normalizeCertificates(row.certificates).length - 2}</span>)}</div>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            );
          })}
          {filteredData.length === 0 && <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><p className="text-sm text-slate-400">검색 결과가 없습니다.</p></div>}
        </div>
      )}

      <CertificatePicker 
        isOpen={pickerOpen} 
        onClose={() => {
          setPickerOpen(false);
          setEditingCell(null);
        }} 
        initialValues={editingCell ? filteredData[editingCell.row].certificates : []} 
        masterCerts={masterCertificates} 
        onSave={(vals: any) => { 
          if(editingCell) handleSaveInternal(filteredData[editingCell.row].id, 'certificates', vals); 
          setPickerOpen(false); 
        }} 
      />
      <MobileDetailModal isOpen={!!detailData} onClose={()=>setDetailData(null)} data={detailData} columns={columns} onSave={handleSaveInternal} onAction={onAction} />
    </div>
  );
}
