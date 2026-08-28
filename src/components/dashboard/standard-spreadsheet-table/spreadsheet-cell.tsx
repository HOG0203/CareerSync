'use client'

import * as React from 'react'
import { X, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StudentPopover } from '@/components/dashboard/student-popover'

export const SpreadsheetCell = React.memo(({ id, field, value, config, rowData, rIdx, cIdx, isEditing, isSelected, isFocused, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, onAction, rankingMap, isRankingsLoading, userProfile, disableNamePopover, baseYear, masterCompanies = [] }: any) => {
  const [localValue, setLocalValue] = React.useState(value || '')
  const [isManualInput, setIsManualInput] = React.useState(false)
  const isManualRef = React.useRef(false)
  const selectRef = React.useRef<HTMLSelectElement>(null)
  const [autocompleteActiveIndex, setAutocompleteActiveIndex] = React.useState(-1)

  const resolvedOptions = React.useMemo(() => {
    if (!isEditing) return undefined;
    if (typeof config.options === 'function') return config.options(rowData);
    return config.options;
  }, [isEditing, config.options, rowData]);

  // 회사명(company) 자동완성 추천 목록 산출
  const isCompanyField = field === 'company' || config.key === 'company';
  const filteredCompanies = React.useMemo(() => {
    if (!isEditing || !isCompanyField || !masterCompanies || masterCompanies.length === 0) return [];
    const search = (localValue || '').trim().toLowerCase();
    if (!search) {
      return masterCompanies.slice(0, 8);
    }
    return masterCompanies
      .filter((c: any) => (c.name || '').toLowerCase().includes(search))
      .slice(0, 10);
  }, [isEditing, isCompanyField, masterCompanies, localValue]);

  React.useEffect(() => {
    if (!isEditing) {
      setIsManualInput(false);
      isManualRef.current = false;
      setAutocompleteActiveIndex(-1);
      return;
    }
    setLocalValue(value || '');
    setAutocompleteActiveIndex(-1);
    const isInOptions = resolvedOptions?.some((o: any) => o.value === value);
    const isManual = !!value && !isInOptions && value !== '기타(직접입력)';
    setIsManualInput(isManual);
    isManualRef.current = isManual;
  }, [value, isEditing, resolvedOptions]);

  // 더블클릭/수정 모드 진입 즉시 0ms 드롭다운 메뉴 팝업 자동 개방 (showPicker)
  React.useEffect(() => {
    if (!isEditing) return;
    if (config.type === 'select' && !isManualInput) {
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
    if (!isEditing) return;
    if (config.type === 'multi-select') {
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

  const handleSelectCompany = React.useCallback((comp: any) => {
    const selectedName = comp.name || '';
    setLocalValue(selectedName);
    handleCommit(selectedName);

    // 등록 기업의 기업구분(company_type)이 존재하고 학생의 기존 기업구분과 다르면 자동 연동 입력
    if (comp.company_type && rowData?.company_type !== comp.company_type) {
      onSave(id, 'company_type', comp.company_type);
    }
  }, [handleCommit, id, onSave, rowData?.company_type]);

  if (isEditing && !config.readOnly && config.type !== 'action') {
    if (config.type === 'select') {
      const isInOptions = resolvedOptions?.some((o: any) => o.value === localValue);
      const isOtherTrigger = localValue === '기타(직접입력)';
      if (isManualInput || isOtherTrigger) {
        return (
          <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative h-8 z-40 bg-white ring-2 ring-blue-500 ring-inset overflow-hidden" style={{ minWidth: config.width, width: config.width }}>
            <div className="flex items-center w-full h-8 bg-white">
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
        <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative h-8 z-40 bg-white ring-2 ring-blue-500 ring-inset overflow-hidden" style={{ minWidth: config.width, width: config.width }}>
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
              sideOffset={4}
              avoidCollisions={true} 
              collisionPadding={8}
              className="z-[9999] max-h-60 !duration-0 !animate-none !transition-none transform-none border border-slate-200 shadow-xl bg-white min-w-[var(--radix-select-trigger-width)] text-[11px]"
            >
              {resolvedOptions?.map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[11px] py-1.5 cursor-pointer focus:bg-blue-50 focus:text-blue-700 font-medium">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      )
    }
    if (config.type === 'date') return (
      <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative h-8 z-40 bg-white ring-2 ring-blue-500 ring-inset overflow-hidden" style={{ minWidth: config.width, width: config.width }}>
        <Popover open={true} onOpenChange={(open) => !open && onEndEdit()}>
          <PopoverTrigger asChild><div className="h-8 w-full flex items-center justify-center text-[11px] cursor-pointer font-medium">{localValue || '-'}</div></PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[200]" align="start" side="bottom" avoidCollisions={true} collisionPadding={10}>
            <Calendar mode="single" selected={localValue ? new Date(localValue) : undefined} onSelect={(date) => date && handleCommit(format(date, 'yyyy-MM-dd'))} locale={ko} initialFocus />
          </PopoverContent>
        </Popover>
      </td>
    )
    if (config.type === 'multi-select') return <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative h-8 z-40 bg-white" style={{ minWidth: config.width, width: config.width }} />;

    // 취업처(회사명) 자동완성 셀 렌더링
    if (isCompanyField) {
      return (
        <td 
          data-row={rIdx} 
          data-col={cIdx} 
          className="p-0 border-r border-b relative h-8 z-50 bg-white ring-2 ring-blue-500 ring-inset" 
          style={{ minWidth: config.width, width: config.width }}
        >
          <Input 
            autoFocus 
            value={localValue} 
            onChange={(e) => {
              setLocalValue(e.target.value);
              setAutocompleteActiveIndex(0);
            }} 
            onBlur={() => {
              // 마우스 클릭 시 자동완성 선택할 수 있도록 약간의 지연 처리
              setTimeout(() => {
                if (!isCommittingRef.current) {
                  handleCommit(localValue);
                }
              }, 180);
            }} 
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                if (filteredCompanies.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  setAutocompleteActiveIndex(prev => (prev < filteredCompanies.length - 1 ? prev + 1 : 0));
                }
              } else if (e.key === 'ArrowUp') {
                if (filteredCompanies.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  setAutocompleteActiveIndex(prev => (prev > 0 ? prev - 1 : filteredCompanies.length - 1));
                }
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (autocompleteActiveIndex >= 0 && filteredCompanies[autocompleteActiveIndex]) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectCompany(filteredCompanies[autocompleteActiveIndex]);
                } else {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  handleCommit(localValue);
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onEndEdit();
              }
            }} 
            placeholder="기업명 입력..."
            className="h-8 w-full text-[11px] border-none rounded-none focus-visible:ring-0 px-1 bg-transparent font-medium" 
          />

          {/* 등록 기업 자동완성 플로팅 드롭다운 */}
          {filteredCompanies.length > 0 && (
            <div className="absolute top-full left-0 mt-0.5 min-w-[210px] max-w-[320px] max-h-56 overflow-y-auto bg-white rounded-lg shadow-2xl border border-slate-200/90 z-[99999] py-1 text-left">
              <div className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-blue-600" />
                  등록 기업 ({filteredCompanies.length})
                </span>
                <span className="text-[9px] text-slate-400 font-normal">↑↓ 이동 · Enter 선택</span>
              </div>
              <div className="divide-y divide-slate-50">
                {filteredCompanies.map((comp: any, idx: number) => (
                  <div
                    key={comp.id || comp.name}
                    className={cn(
                      "px-2.5 py-1.5 cursor-pointer text-left transition-colors flex items-center justify-between gap-2",
                      idx === autocompleteActiveIndex ? "bg-blue-50 text-blue-900 font-bold" : "hover:bg-slate-50 text-slate-800 font-medium"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectCompany(comp);
                    }}
                  >
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-[11px] truncate text-slate-900">{comp.name}</span>
                      {comp.location && (
                        <span className="text-[9px] text-slate-400 truncate">({comp.location})</span>
                      )}
                    </div>
                    {comp.company_type && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                        {comp.company_type}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </td>
      );
    }

    return (
      <td data-row={rIdx} data-col={cIdx} className="p-0 border-r border-b relative h-8 z-40 bg-white ring-2 ring-blue-500 ring-inset overflow-hidden" style={{ minWidth: config.width, width: config.width }}>
        <Input autoFocus value={localValue} onChange={(e) => setLocalValue(e.target.value)} onBlur={() => handleCommit(localValue)} onKeyDown={(e) => { if(e.key==='Enter') { e.preventDefault(); e.stopPropagation(); handleCommit(localValue); } if(e.key==='Escape') { e.preventDefault(); e.stopPropagation(); onEndEdit(); } }} className="h-8 w-full text-[11px] border-none rounded-none focus-visible:ring-0 px-1 bg-transparent font-medium" />
      </td>
    )
  }


  return (
    <td
      data-row={rIdx}
      data-col={cIdx}
      className={cn("p-0 border-r border-b relative h-8 transition-none select-none cursor-cell text-center overflow-hidden", isSelected && "bg-blue-50/70", isFocused && "ring-2 ring-blue-500 ring-inset z-10")}
      style={{ minWidth: config.width, width: config.width }}
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
  p.disableNamePopover === n.disableNamePopover &&
  p.masterCompanies === n.masterCompanies
);
SpreadsheetCell.displayName = 'SpreadsheetCell';

