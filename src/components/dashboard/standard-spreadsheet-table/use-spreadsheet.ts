'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { ColumnConfig } from './types'

interface UseSpreadsheetProps {
  initialData: any[]
  columns: ColumnConfig[]
  onSave: (id: string, field: string, value: any) => Promise<{ success: boolean; error?: string }>
  onBulkSave: (updates: { id: string; field: string; value: any }[]) => Promise<{ success: boolean; error?: string }>
  groupHeaders?: { label: string; colSpan: number; className?: string }[]
  externalSelectedRowIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

export function useSpreadsheet({
  initialData,
  columns,
  onSave,
  onBulkSave,
  groupHeaders,
  externalSelectedRowIds,
  onSelectionChange,
}: UseSpreadsheetProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [data, setData] = React.useState(initialData)
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string[]>>({})
  const [searchTerm, setSearchTerm] = React.useState('')
  const [selectionStart, setSelectionStart] = React.useState<any>(null)
  const [selectionEnd, setSelectionEnd] = React.useState<any>(null)
  const [editingCell, setEditingCell] = React.useState<any>(null)
  const [internalSelectedRowIds, setInternalSelectedRowIds] = React.useState<string[]>([])
  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerHeight, setContainerHeight] = React.useState(1200)
  const [isPickerOpen, setIsPickerOpen] = React.useState(false)
  const [detailData, setDetailData] = React.useState<any>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const isSelectingRef = React.useRef(false)

  const ROW_HEIGHT = 32
  const HEADER_HEIGHT = groupHeaders ? 80 : 40

  // Undo/Redo
  const [history, setHistory] = React.useState<{ id: string; field: string; oldValue: any }[][]>([])
  const [redoStack, setRedoStack] = React.useState<{ id: string; field: string; newValue: any }[][]>([])
  const isSyncingRef = React.useRef(false)

  const recordHistory = React.useCallback((updates: { id: string; field: string; oldValue: any }[]) => {
    if (isSyncingRef.current) return;
    setHistory(prev => [updates, ...prev].slice(0, 20));
    setRedoStack([]);
  }, [])

  const handleUndo = React.useCallback(async () => {
    if (history.length === 0 || isSyncingRef.current) return;
    isSyncingRef.current = true;
    const lastChanges = history[0];
    const newHistory = history.slice(1);
    const newData = [...data];
    const serverUpdates: any[] = [];
    const redoUpdates: any[] = [];
    lastChanges.forEach((change) => {
      const dIdx = newData.findIndex(s => s.id === change.id);
      if (dIdx !== -1) {
        redoUpdates.push({ id: change.id, field: change.field, newValue: newData[dIdx][change.field] });
        newData[dIdx] = { ...newData[dIdx], [change.field]: change.oldValue };
        serverUpdates.push({ id: change.id, field: change.field, value: change.oldValue });
      }
    });
    setData(newData); setHistory(newHistory); setRedoStack(prev => [redoUpdates, ...prev].slice(0, 20));
    const result = await onBulkSave(serverUpdates);
    if (result.success) { toast({ title: '실행 취소 완료' }); router.refresh(); }
    setTimeout(() => { isSyncingRef.current = false; }, 500);
  }, [history, data, onBulkSave, toast, router])

  const handleRedo = React.useCallback(async () => {
    if (redoStack.length === 0 || isSyncingRef.current) return;
    isSyncingRef.current = true;
    const lastRedo = redoStack[0];
    const newRedoStack = redoStack.slice(1);
    const newData = [...data];
    const serverUpdates: any[] = [];
    const undoUpdates: any[] = [];
    lastRedo.forEach((change) => {
      const dIdx = newData.findIndex(s => s.id === change.id);
      if (dIdx !== -1) {
        undoUpdates.push({ id: change.id, field: change.field, oldValue: newData[dIdx][change.field] });
        newData[dIdx] = { ...newData[dIdx], [change.field]: change.newValue };
        serverUpdates.push({ id: change.id, field: change.field, value: change.newValue });
      }
    });
    setData(newData); setRedoStack(newRedoStack); setHistory(prev => [undoUpdates, ...prev].slice(0, 20));
    const result = await onBulkSave(serverUpdates);
    if (result.success) { toast({ title: '다시 실행 완료' }); router.refresh(); }
    setTimeout(() => { isSyncingRef.current = false; }, 500);
  }, [redoStack, data, onBulkSave, toast, router])

  React.useEffect(() => { if (!isSyncingRef.current) { setData(initialData); } }, [initialData])
  React.useEffect(() => { setInternalSelectedRowIds([]); setSelectionStart(null); setSelectionEnd(null); }, [initialData])

  // Filter options (faceted)
  const filterOptions = React.useMemo(() => {
    const opts: Record<string, Set<any>> = {};
    columns.forEach(c => opts[c.key] = new Set());
    initialData.forEach(s => {
      columns.forEach(c => {
        const matchesOtherFilters = Object.entries(columnFilters).every(([f, v]) => {
          if (f === c.key) return true;
          if (v === undefined) return true;
          const rowVal = s[f];
          const nV = (rowVal === null || rowVal === undefined || rowVal === '') ? '(빈칸)' : String(rowVal);
          return v.includes(nV);
        });
        const matchesSearch = !searchTerm || columns.some(col =>
          String(s[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (matchesOtherFilters && matchesSearch) {
          const val = s[c.key];
          opts[c.key].add((val === null || val === undefined || val === '') ? '(빈칸)' : String(val));
        }
      });
    });
    const result: Record<string, any[]> = {};
    Object.keys(opts).forEach(k => {
      result[k] = Array.from(opts[k]).sort((a, b) => {
        if (a === '(빈칸)') return -1;
        if (b === '(빈칸)') return 1;
        return a.localeCompare(b, 'ko');
      });
    });
    return result;
  }, [initialData, columns, columnFilters, searchTerm])

  const handleFilterChange = React.useCallback((key: string, value: string) => {
    setColumnFilters(prev => {
      const currentOpts = filterOptions[key] || [];
      const isFilterActive = prev[key] !== undefined;
      if (value === 'RESET' || value === 'SELECT_ALL') {
        const next = { ...prev }; delete next[key]; return next;
      }
      if (value === 'CLEAR_ALL') return { ...prev, [key]: [] };
      let nextSelected: string[];
      if (!isFilterActive) {
        nextSelected = currentOpts.map(o => String(o)).filter(x => x !== value);
      } else {
        const activeList = prev[key];
        nextSelected = activeList.includes(value)
          ? activeList.filter(x => x !== value)
          : [...activeList, value];
      }
      if (nextSelected.length === currentOpts.length) {
        const next = { ...prev }; delete next[key]; return next;
      }
      return { ...prev, [key]: nextSelected };
    });
  }, [filterOptions])

  const filteredData = React.useMemo(() => data.filter(row => {
    const mF = Object.entries(columnFilters).every(([f, v]) => {
      if (v === undefined) return true;
      const rowVal = row[f];
      const nV = (rowVal === null || rowVal === undefined || rowVal === '') ? '(빈칸)' : String(rowVal);
      return v.includes(nV);
    });
    const mS = !searchTerm || columns.some(c => String(row[c.key] || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return mF && mS;
  }), [data, columnFilters, searchTerm, columns])

  // Effects
  React.useEffect(() => {
    setSelectionStart(null); setSelectionEnd(null);
    if (containerRef.current) {
      const maxScroll = Math.max(0, filteredData.length * ROW_HEIGHT + HEADER_HEIGHT - containerHeight);
      if (containerRef.current.scrollTop > maxScroll) containerRef.current.scrollTop = 0;
    }
  }, [columnFilters, searchTerm, filteredData.length, containerHeight, HEADER_HEIGHT])

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((e) => { for (const entry of e) setContainerHeight(entry.contentRect.height); });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [])

  React.useEffect(() => {
    const stop = () => { isSelectingRef.current = false };
    window.addEventListener('mouseup', stop);
    window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('mouseup', stop); window.removeEventListener('pointerup', stop); };
  }, [])

  const selectedRowIds = externalSelectedRowIds || internalSelectedRowIds
  const syncSelected = React.useCallback((ids: string[]) => onSelectionChange ? onSelectionChange(ids) : setInternalSelectedRowIds(ids), [onSelectionChange])
  const handleSelectAll = React.useCallback((checked: any) => syncSelected(checked ? filteredData.map(r => r.id) : []), [filteredData, syncSelected])
  
  // 0.001ms 오프셋 사전 계산 (DOM layout thrashing 완전 제거)
  const colWidthOffsets = React.useMemo(() => {
    const offsets: number[] = [32];
    let accum = 32;
    for (let i = 0; i < columns.length; i++) {
      const w = typeof columns[i]?.width === 'number' ? (columns[i].width as number) : 80;
      accum += w;
      offsets.push(accum);
    }
    return offsets;
  }, [columns]);

  // 초고속 가로/세로 자동 스크롤 함수
  const scrollToCell = React.useCallback((row: number, col: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. 세로 스크롤 (순수 수식)
    const targetY = row * ROW_HEIGHT + HEADER_HEIGHT;
    const curY = container.scrollTop;
    const ch = container.clientHeight;

    if (targetY < curY + HEADER_HEIGHT) {
      container.scrollTop = Math.max(0, targetY - HEADER_HEIGHT);
    } else if (targetY + ROW_HEIGHT > curY + ch) {
      container.scrollTop = targetY + ROW_HEIGHT - ch;
    }

    // 2. 가로 스크롤 (선택된 열 오프셋 위치로 정밀 자동 이동)
    const startX = colWidthOffsets[col] ?? 32;
    const curX = container.scrollLeft;
    const cw = container.clientWidth;

    if (col <= 1) {
      if (curX > 0) container.scrollLeft = 0;
    } else {
      // 선택된 열의 시작점 startX가 항상 시야에 여유 있게(100px 오프셋) 들어오도록 직관적 가로 이동
      const targetScrollX = Math.max(0, startX - 100);
      if (Math.abs(container.scrollLeft - targetScrollX) > 5) {
        container.scrollLeft = targetScrollX;
      }
    }
  }, [colWidthOffsets, ROW_HEIGHT, HEADER_HEIGHT]);

  const rafRef = React.useRef<number | null>(null);
  const requestScrollToCell = React.useCallback((row: number, col: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      scrollToCell(row, col);
    });
  }, [scrollToCell]);

  // 셀 선택 또는 수정 모드 전환 시 커서 위치로 비동기 프레임 스크롤
  React.useEffect(() => {
    const target = editingCell || selectionStart;
    if (target && typeof target.row === 'number' && typeof target.col === 'number') {
      requestScrollToCell(target.row, target.col);
    }
  }, [selectionStart, editingCell, requestScrollToCell]);

  const handleMouseDown = React.useCallback((row: any, col: any, multi: any) => {
    isSelectingRef.current = true;
    setEditingCell(null);
    if (multi && selectionStart) setSelectionEnd({ row, col });
    else { setSelectionStart({ row, col }); setSelectionEnd({ row, col }); }
    if (containerRef.current) containerRef.current.focus({ preventScroll: true });
    requestScrollToCell(row, col);
  }, [selectionStart, requestScrollToCell])

  const handleMouseEnter = React.useCallback((row: any, col: any) => {
    if (isSelectingRef.current) setSelectionEnd({ row, col });
  }, [])

  const handleCopy = React.useCallback(async () => {
    if (!selectionStart || !selectionEnd) return;
    const minR = Math.min(selectionStart.row, selectionEnd.row), maxR = Math.max(selectionStart.row, selectionEnd.row);
    const minC = Math.min(selectionStart.col, selectionEnd.col), maxC = Math.max(selectionStart.col, selectionEnd.col);
    let text = "";
    for (let r = minR; r <= maxR; r++) {
      const rowData = filteredData[r]; if (!rowData) continue;
      const line = [];
      for (let c = minC; c <= maxC; c++) { const val = rowData[columns[c].key]; line.push(Array.isArray(val) ? val.join(', ') : (val || '')); }
      text += line.join('\t') + (r === maxR ? "" : "\n");
    }
    try { await navigator.clipboard.writeText(text); toast({ title: '복사 완료' }); }
    catch { toast({ variant: 'destructive', title: '복사 실패' }); }
  }, [selectionStart, selectionEnd, filteredData, columns, toast])

  const handlePaste = React.useCallback(async () => {
    if (!selectionStart) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const cb = text.split(/\r?\n/).filter(line => line.length > 0).map(row => row.split('\t'));
      const cbH = cb.length, cbW = cb[0].length;
      const selEnd = selectionEnd || selectionStart;
      const minR = Math.min(selectionStart.row, selEnd.row), maxR = Math.max(selectionStart.row, selEnd.row);
      const minC = Math.min(selectionStart.col, selEnd.col), maxC = Math.max(selectionStart.col, selEnd.col);
      const tMaxR = (selectionStart.row === selEnd.row && selectionStart.col === selEnd.col) ? minR + cbH - 1 : maxR;
      const tMaxC = (selectionStart.row === selEnd.row && selectionStart.col === selEnd.col) ? minC + cbW - 1 : maxC;
      const updates: any[] = []; const historyUpdates: any[] = []; const newData = [...data];
      for (let r = minR; r <= tMaxR; r++) {
        const rowData = filteredData[r]; if (!rowData) continue;
        const dIdx = newData.findIndex(s => s.id === rowData.id); if (dIdx === -1) continue;
        const rO = r - minR, cbR = rO % cbH;
        for (let c = minC; c <= tMaxC; c++) {
          const config = columns[c]; if (!config || config.readOnly || config.type === 'action') continue;
          const cO = c - minC, cbC = cO % cbW; let val = cb[cbR][cbC];
          if (val === undefined) continue;
          let finalVal: any = val.trim();
          if (config.type === 'multi-select') finalVal = finalVal ? finalVal.split(',').map((v: any) => v.trim()) : [];
          if (newData[dIdx][config.key] !== finalVal) {
            historyUpdates.push({ id: rowData.id, field: config.key, oldValue: newData[dIdx][config.key] });
            newData[dIdx] = { ...newData[dIdx], [config.key]: finalVal };
            updates.push({ id: rowData.id, field: config.key, value: finalVal });
          }
        }
      }
      if (updates.length > 0) {
        recordHistory(historyUpdates); setData(newData);
        const result = await onBulkSave(updates);
        if (result.success) toast({ title: '붙여넣기 완료' }); else toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    } catch { toast({ variant: 'destructive', title: '붙여넣기 실패' }); }
  }, [selectionStart, selectionEnd, filteredData, columns, data, onBulkSave, toast, recordHistory])

  const handleDelete = React.useCallback(async () => {
    if (editingCell || !selectionStart || !selectionEnd) return;
    const minR = Math.min(selectionStart.row, selectionEnd.row), maxR = Math.max(selectionStart.row, selectionEnd.row);
    const minC = Math.min(selectionStart.col, selectionEnd.col), maxC = Math.max(selectionStart.col, selectionEnd.col);
    const updates: any[] = []; const hUpdates: any[] = []; const newData = [...data];
    for (let r = minR; r <= maxR; r++) {
      const rowData = filteredData[r]; if (!rowData) continue;
      const dIdx = newData.findIndex(s => s.id === rowData.id); if (dIdx === -1) continue;
      for (let c = minC; c <= maxC; c++) {
        const config = columns[c]; if (config.readOnly || config.type === 'action') continue;
        const emptyVal = config.key === 'certificates' ? [] : '';
        if (newData[dIdx][config.key] !== emptyVal) {
          hUpdates.push({ id: rowData.id, field: config.key, oldValue: newData[dIdx][config.key] });
          newData[dIdx] = { ...newData[dIdx], [config.key]: emptyVal };
          updates.push({ id: rowData.id, field: config.key, value: emptyVal });
        }
      }
    }
    if (updates.length > 0) {
      recordHistory(hUpdates); setData(newData);
      const result = await onBulkSave(updates);
      if (result.success) toast({ title: '셀 지우기 완료' }); else toast({ variant: 'destructive', title: '삭제 실패' });
    }
  }, [editingCell, selectionStart, selectionEnd, filteredData, columns, data, onBulkSave, toast, recordHistory])

  const handleSaveInternal = React.useCallback(async (id: any, field: any, value: any) => {
    const rIdx = filteredData.findIndex(r => r.id === id);
    const cIdx = columns.findIndex(c => c.key === field);
    if (value === 'OPEN_PICKER') {
      if (rIdx !== -1) setEditingCell({ row: rIdx, col: cIdx });
      setIsPickerOpen(true);
      return { success: true };
    }
    const finalValue = (value === 'CLEARED' || value === '') ? null : value;
    const student = data.find(s => s.id === id);

    // 2차 확인 모달 / 서버 저장을 먼저 수행하고 승인될 때만 클라이언트 데이터 반영
    const result = await onSave(id, field, finalValue);

    if (result && result.success) {
      if (student && student[field] !== finalValue) recordHistory([{ id, field, oldValue: student[field] }]);
      setEditingCell(null);
      setData(prev => prev.map(s => s.id === id ? { ...s, [field]: finalValue } : s));
      setDetailData((prev: any) => (prev && prev.id === id) ? { ...prev, [field]: finalValue } : prev);
      return result;
    } else {
      setEditingCell(null);
      return result || { success: false };
    }
  }, [onSave, filteredData, columns, data, recordHistory])




  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (editingCell) return;
    if (e.ctrlKey && e.key === 'c') { e.preventDefault(); handleCopy(); return; }
    if (e.ctrlKey && e.key === 'v') { e.preventDefault(); handlePaste(); return; }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDelete(); return; }
    let { row, col } = selectionEnd || selectionStart || { row: 0, col: 0 };
    switch (e.key) {
      case 'ArrowUp': row = Math.max(0, row - 1); break;
      case 'ArrowDown': row = Math.min(filteredData.length - 1, row + 1); break;
      case 'ArrowLeft': col = Math.max(0, col - 1); break;
      case 'ArrowRight': col = Math.min(columns.length - 1, col + 1); break;
      case 'Enter':
        if (selectionStart) {
          const config = columns[selectionStart.col];
          if (config.type === 'multi-select') { setEditingCell({ row: selectionStart.row, col: selectionStart.col }); setIsPickerOpen(true); }
          else setEditingCell({ row: selectionStart.row, col: selectionStart.col });
        }
        return;
      case 'Escape': setSelectionStart(null); setSelectionEnd(null); return;
      default: return;
    }
    e.preventDefault();
    if (e.shiftKey) setSelectionEnd({ row, col });
    else { setSelectionStart({ row, col }); setSelectionEnd({ row, col }); }
    
    requestScrollToCell(row, col);
  }, [editingCell, selectionStart, selectionEnd, filteredData, columns, handleDelete, handleCopy, handlePaste, handleUndo, handleRedo, requestScrollToCell])

  return {
    data,
    filteredData,
    filterOptions,
    columnFilters,
    searchTerm,
    setSearchTerm,
    handleFilterChange,
    selectionStart,
    selectionEnd,
    editingCell,
    setEditingCell,
    selectedRowIds,
    syncSelected,
    handleSelectAll,
    scrollTop,
    setScrollTop,
    containerHeight,
    containerRef,
    isPickerOpen,
    setIsPickerOpen,
    detailData,
    setDetailData,
    ROW_HEIGHT,
    HEADER_HEIGHT,
    handleMouseDown,
    handleMouseEnter,
    handleSaveInternal,
    handleKeyDown,
  }
}
