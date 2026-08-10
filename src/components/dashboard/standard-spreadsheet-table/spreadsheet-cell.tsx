'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StudentPopover } from '@/components/dashboard/student-popover'

export const SpreadsheetCell = React.memo(({ id, field, value, config, rowData, rIdx, cIdx, isEditing, isSelected, isFocused, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, onAction, rankingMap, isRankingsLoading, userProfile, disableNamePopover, baseYear }: any) => {
  const [localValue, setLocalValue] = React.useState(value || '')
  const [isManualInput, setIsManualInput] = React.useState(false)
  const isManualRef = React.useRef(false)
  const selectRef = React.useRef<HTMLSelectElement>(null)

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

  // 더블클릭/수정 모드 진입 즉시 0ms 드롭다운 메뉴 팝업 자동 개방 (showPicker)
  React.useEffect(() => {
    if (isEditing && config.type === 'select' && !isManualInput) {
      if (selectRef.current) {
        try {
          if (typeof selectRef.current.showPicker === 'function') {
            selectRef.current.showPicker();
          } else {
            selectRef.current.focus();
          }
        } catch {
          selectRef.current?.focus();
        }
      }
    }
  }, [isEditing, config.type, isManualInput]);

  React.useEffect(() => {
    if (isEditing && config.type === 'multi-select') {
      const timer = setTimeout(() => onSave(id, field, 'OPEN_PICKER'), 0);
      return () => clearTimeout(timer);
    }
  }, [isEditing, config.type, id, field, onSave]);

  const isCommittingRef = React.useRef(false);

  React.useEffect(() => {
    if (!isEditing) {
      isCommittingRef.current = false;
    }
  }, [isEditing]);

  const handleCommit = React.useCallback((v: any) => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;

    const finalVal = v === '기타(직접입력)' ? '' : v;
    if (finalVal !== value) {
      onSave(id, field, finalVal);
    }
    onEndEdit();
  }, [id, field, value, onSave, onEndEdit]);

  if (isEditing && !config.readOnly && config.type !== 'action') {
    if (config.type === 'select') {
      const isInOptions = resolvedOptions?.some((o: any) => o.value === localValue);
      const isOtherTrigger = localValue === '기타(직접입력)';
      if (isManualInput || isOtherTrigger) {
        return (
          <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
            <div className="flex items-center w-full bg-white">
              <Input autoFocus value={isOtherTrigger ? '' : localValue} onChange={(e) => { setLocalValue(e.target.value); setIsManualInput(true); isManualRef.current = true; }} onBlur={() => handleCommit(localValue)} onKeyDown={(e) => { if(e.key==='Enter') { e.preventDefault(); e.stopPropagation(); handleCommit(localValue); } if(e.key==='Escape') { e.preventDefault(); e.stopPropagation(); onEndEdit(); } }} className="h-8 w-full text-[11px] border-none rounded-none focus-visible:ring-0 px-1 bg-transparent font-medium" placeholder="내용 입력..." />
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 shrink-0 text-slate-400 hover:text-rose-500" 
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  isManualRef.current = false;
                  setIsManualInput(false);
                  setLocalValue('');
                  handleCommit('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </td>
        )
      }
      return (
        <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
          <Select
            open={true}
            value={isInOptions ? localValue : ''}
            onValueChange={(v) => {
              if (v === '기타(직접입력)') {
                isManualRef.current = true;
                setIsManualInput(true);
                setLocalValue('기타(직접입력)');
              } else {
                handleCommit(v);
              }
            }}
            onOpenChange={(open) => {
              if (!open && !isManualRef.current) {
                onEndEdit();
              }
            }}
          >
            <SelectTrigger className="h-8 w-full text-[11px] border-none outline-none focus:ring-0 px-1 bg-white font-medium cursor-pointer rounded-none">
              <SelectValue placeholder="선택..." />
            </SelectTrigger>
            <SelectContent 
              position="popper" 
              side="bottom" 
              avoidCollisions={true} 
              collisionPadding={10}
              className="z-[200] max-h-60 duration-0 animate-none transition-none"
            >
              {resolvedOptions?.map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[11px] py-1">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      )
    }
    if (config.type === 'date') return (
      <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
        <Popover open={true} onOpenChange={(open) => !open && onEndEdit()}>
          <PopoverTrigger asChild><div className="h-8 w-full flex items-center justify-center text-[11px] cursor-pointer font-medium">{localValue || '-'}</div></PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[200]" align="start" side="bottom" avoidCollisions={true} collisionPadding={10}>
            <Calendar mode="single" selected={localValue ? new Date(localValue) : undefined} onSelect={(date) => date && handleCommit(format(date, 'yyyy-MM-dd'))} locale={ko} initialFocus />
          </PopoverContent>
        </Popover>
      </td>
    )
    if (config.type === 'multi-select') return <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative z-40 bg-white" />;
    return (
      <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative z-40 bg-white ring-2 ring-blue-500" style={{ width: config.width }}>
        <Input autoFocus value={localValue} onChange={(e) => setLocalValue(e.target.value)} onBlur={() => handleCommit(localValue)} onKeyDown={(e) => { if(e.key==='Enter') { e.preventDefault(); e.stopPropagation(); handleCommit(localValue); } if(e.key==='Escape') { e.preventDefault(); e.stopPropagation(); onEndEdit(); } }} className="h-8 w-full text-[11px] border-none rounded-none focus-visible:ring-0 px-1 bg-transparent font-medium" />
      </td>
    )
  }


  return (
    <td
      data-row={rIdx}
      data-col={cIdx}
      className={cn("p-0 border-r border-b relative h-8 transition-none select-none cursor-cell text-center overflow-hidden", isSelected && "bg-blue-50/70", isFocused && "ring-2 ring-blue-500 ring-inset z-10")}
      style={{ minWidth: config.width, width: 'auto' }}
      onMouseDown={(e) => onMouseDown(e.shiftKey)} onMouseEnter={onMouseEnter} onDoubleClick={() => !config.readOnly && config.type !== 'action' && onStartEdit()}
    >
      <div className="px-2 text-[11px] w-full h-full flex items-center justify-center whitespace-nowrap">
        {config.type === 'action' ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-blue-50 text-blue-600 font-bold hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); onAction?.(id, field); }}>상세보기</Button>
        ) : field === 'student_name' ? (
          !disableNamePopover ? (
            <StudentPopover student={rowData} rankingSummary={rankingMap?.[id]} isRankingsLoading={isRankingsLoading} userProfile={userProfile} baseYear={baseYear}>
              <h3 className="font-bold text-slate-900 truncate hover:text-blue-600 transition-colors cursor-pointer underline decoration-dotted decoration-blue-300 underline-offset-4">{value || ''}</h3>
            </StudentPopover>
          ) : (
            <span className="font-bold text-slate-900 truncate">{value || ''}</span>
          )
        ) : config.variant ? (
          <span className={cn("px-1.5 py-0.5 rounded-sm font-medium border text-[9px] leading-none whitespace-nowrap text-center", config.variant(value))}>{value === 'X' ? '' : (value || '')}</span>
        ) : (
          <span className="whitespace-nowrap">{Array.isArray(value) ? value.join(', ') : (value === 'X' ? '' : (value || ''))}</span>
        )}
      </div>
    </td>
  )
}, (p, n) =>
  p.value === n.value &&
  p.isEditing === n.isEditing &&
  p.isSelected === n.isSelected &&
  p.isFocused === n.isFocused &&
  p.rankingMap === n.rankingMap &&
  p.isRankingsLoading === n.isRankingsLoading &&
  p.userProfile === n.userProfile &&
  p.onMouseDown === n.onMouseDown &&
  p.onMouseEnter === n.onMouseEnter &&
  p.disableNamePopover === n.disableNamePopover
);
SpreadsheetCell.displayName = 'SpreadsheetCell';
