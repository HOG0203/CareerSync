'use client'

import * as React from 'react'
import { Search, GraduationCap, Trash2, Loader2, Phone, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { StudentPopover } from '@/components/dashboard/student-popover'
import { SpreadsheetTableProps } from './types'
import { normalizeCertificates } from './utils'
import { TableHeader } from './table-header'
import { SpreadsheetRow } from './spreadsheet-row'
import { CertificatePicker } from './certificate-picker'
import { MobileDetailModal } from './mobile-detail-modal'
import { useSpreadsheet } from './use-spreadsheet'

export function StandardSpreadsheetTable({
  data: initialData,
  columns,
  onSave,
  onBulkSave,
  onPromote,
  onDelete,
  onAction,
  selectedRowIds: externalSelectedRowIds,
  onSelectionChange,
  groupHeaders,
  searchPlaceholder = "검색...",
  masterCertificates = [],
  rankingMap = {},
  isRankingsLoading = false,
  userProfile = null,
  disableNamePopover = false,
  baseYear,
  mobileInfoKeys,
}: SpreadsheetTableProps) {
  const [mounted, setMounted] = React.useState(false)
  const isMobile = useIsMobile()

  React.useEffect(() => { setMounted(true); }, [])

  const {
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
    containerRef,
    isPickerOpen,
    setIsPickerOpen,
    detailData,
    setDetailData,
    ROW_HEIGHT,
    HEADER_HEIGHT,
    containerHeight,
    handleMouseDown,
    handleMouseEnter,
    handleSaveInternal,
    handleKeyDown,
  } = useSpreadsheet({ initialData, columns, onSave, onBulkSave, groupHeaders, externalSelectedRowIds, onSelectionChange })

  if (!mounted) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-hidden">
      {/* 검색 및 선택 툴바 */}
      <div className="flex items-center justify-between p-2 bg-muted/20 rounded-md border-dashed border shrink-0">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground ml-2" />
          <Input
            placeholder={searchPlaceholder}
            className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs w-[250px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {(searchTerm || Object.values(columnFilters).some(v => v.length > 0)) && (
            <Badge variant="secondary" className="h-6 bg-blue-50 text-blue-600 border-blue-100 font-bold px-2 animate-in fade-in zoom-in-95 duration-200">
              검색 결과: {filteredData.length}명
            </Badge>
          )}
        </div>
        {selectedRowIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
            <span className="text-xs font-bold text-blue-700 mr-2">{selectedRowIds.length}명 선택됨</span>
            {onPromote && <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={async () => { const r = await onPromote(selectedRowIds); if (r.success) syncSelected([]); }}><GraduationCap className="h-3.5 w-3.5 mr-1.5" />진급 설정</Button>}
            {onDelete && <Button size="sm" variant="destructive" className="h-8 shadow-md" onClick={async () => { if (confirm('정말 삭제하시겠습니까?')) { const r = await onDelete(selectedRowIds); if (r.success) syncSelected([]); } }}><Trash2 className="h-3.5 w-3.5 mr-1.5" />삭제</Button>}
            <Button size="sm" variant="outline" className="h-8" onClick={() => syncSelected([])}>선택 취소</Button>
          </div>
        )}
      </div>

      {/* 데스크톱: 스프레드시트 테이블 */}
      {!isMobile ? (
        <div ref={containerRef} className="relative outline-none bg-white overflow-auto border rounded-md shadow-inner custom-scrollbar flex-1 max-h-[calc(100vh-210px)] focus-visible:ring-0" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} onKeyDown={handleKeyDown} tabIndex={0}>
          <table className="text-[11px] border-collapse table-auto min-w-max text-center relative border-none">
            <colgroup>
              <col style={{ width: 32 }} />
              {columns.map((c, i) => <col key={i} style={{ minWidth: c.width }} />)}
            </colgroup>
            <TableHeader
              columns={columns}
              groupHeaders={groupHeaders}
              filterOptions={filterOptions}
              columnFilters={columnFilters}
              onFilterChange={handleFilterChange}
              onSelectAll={handleSelectAll}
              isAllSelected={filteredData.length > 0 && filteredData.every(r => selectedRowIds.includes(r.id))}
            />
            <tbody>
              {(() => {
                const totalCount = filteredData.length;
                // 가상 스크롤 비활성화: 모든 행을 항상 렌더링 (300명 수준은 성능 문제 없음)
                const start = 0;
                const end = totalCount - 1;
                const sMinR = selectionStart && selectionEnd ? Math.min(selectionStart.row, selectionEnd.row) : -1;
                const sMaxR = selectionStart && selectionEnd ? Math.max(selectionStart.row, selectionEnd.row) : -1;
                const sMinC = selectionStart && selectionEnd ? Math.min(selectionStart.col, selectionEnd.col) : -1;
                const sMaxC = selectionStart && selectionEnd ? Math.max(selectionStart.col, selectionEnd.col) : -1;
                const rows = [];
                if (start > 0) rows.push(<tr key="t" style={{ height: start * ROW_HEIGHT }}><td colSpan={columns.length + 1} className="border-none"></td></tr>);
                for (let i = start; i <= end; i++) {
                  const row = filteredData[i]; if (!row) continue;
                  rows.push(
                    <SpreadsheetRow key={row.id} rIdx={i} row={row} columns={columns} selMinR={sMinR} selMaxR={sMaxR} selMinC={sMinC} selMaxC={sMaxC} selStart={selectionStart} editCell={editingCell} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} onStartEdit={(r: any, c: any) => { if (columns[c].type === 'multi-select') { setEditingCell({ row: r, col: c }); setIsPickerOpen(true); } else setEditingCell({ row: r, col: c }); }} onEndEdit={() => setEditingCell(null)} onSave={handleSaveInternal} isSelectedRow={selectedRowIds.includes(row.id)} onSelectRow={(id: any, v: any) => syncSelected(v ? [...selectedRowIds, id] : selectedRowIds.filter(x => x !== id))} onAction={onAction} rankingMap={rankingMap} isRankingsLoading={isRankingsLoading} userProfile={userProfile} disableNamePopover={disableNamePopover} baseYear={baseYear} />
                  );
                }
                if (end < totalCount - 1) rows.push(<tr key="b" style={{ height: (totalCount - 1 - end) * ROW_HEIGHT }}><td colSpan={columns.length + 1} className="border-none"></td></tr>);
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      ) : (
        /* 모바일: 카드 목록 */
        <div className="grid grid-cols-1 gap-3 lg:hidden p-1 overflow-y-auto">
          {filteredData.map((row) => {
            const titleCol = columns.find(c => c.key.includes('name')) || columns[1];
            const statusCol = columns.find(c => c.key.includes('status') || c.key.includes('aspiration'));
            // mobileInfoKeys가 지정된 경우 해당 키에 맞는 컬럼만, 없으면 자동 선택
            const infoCols = mobileInfoKeys
              ? mobileInfoKeys
                  .map(k => columns.find(c => c.key === k))
                  .filter((c): c is NonNullable<typeof c> => !!c)
              : columns.filter(c =>
                  c.key !== 'major' && c.key !== 'class_info' && c.key !== 'student_number' &&
                  c.key !== titleCol?.key && c.key !== statusCol?.key &&
                  c.type !== 'action' && c.key !== 'certificates'
                ).slice(0, 6);
            return (
              <div key={row.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer" onClick={() => setDetailData(row)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                      {String(row[titleCol?.key || ''] || '?')[0]}
                    </div>
                    <div className="min-w-0">
                      {!disableNamePopover ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <StudentPopover student={row} rankingSummary={rankingMap?.[row.id]} isRankingsLoading={isRankingsLoading} userProfile={userProfile} baseYear={baseYear}>
                            <h3 className="font-bold text-slate-900 truncate hover:text-blue-600 transition-colors cursor-pointer">{row[titleCol?.key || ''] || '이름 없음'}</h3>
                          </StudentPopover>
                        </div>
                      ) : (
                        <h3 className="font-bold text-slate-900 truncate">{row[titleCol?.key || ''] || '이름 없음'}</h3>
                      )}
                      <p className="text-[11px] text-slate-500 truncate">
                        {row.major || ''} {row.class_info ? `${row.class_info}반` : ''} {row.student_number ? `${row.student_number}번` : ''}
                      </p>
                    </div>
                  </div>
                  {statusCol && <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0", statusCol.variant?.(row[statusCol.key]))}>{row[statusCol.key] || '미설정'}</Badge>}
                </div>
                <div className={`grid gap-x-2 gap-y-3 border-t border-slate-50 pt-3 ${infoCols.length >= 5 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {infoCols.map(col => (
                    <div key={col.key} className="space-y-0.5 min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{col.label.replace(/\\n/g, ' ')}</p>
                      {col.variant && row[col.key] ? (
                        <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-full', col.variant(row[col.key]))}>
                          {row[col.key]}
                        </span>
                      ) : col.key === 'phone_number' && row[col.key] ? (
                        <a href={`tel:${row[col.key]}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold">
                          <span>{row[col.key]}</span>
                          <Phone className="h-3 w-3 text-blue-500 shrink-0" />
                        </a>
                      ) : (
                        <p className="text-xs font-semibold text-slate-700 truncate">{row[col.key] || '-'}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-slate-400">
                  <div className="flex gap-1 overflow-hidden">
                    {normalizeCertificates(row?.certificates || []).slice(0, 2).map((cert, i) => (<span key={i} className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm whitespace-nowrap">{cert}</span>))}
                    {normalizeCertificates(row?.certificates || []).length > 2 && (<span className="text-[8px] text-slate-400">+{normalizeCertificates(row?.certificates || []).length - 2}</span>)}
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            );
          })}
          {filteredData.length === 0 && <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><p className="text-sm text-slate-400">검색 결과가 없습니다.</p></div>}
        </div>
      )}

      <CertificatePicker
        isOpen={isPickerOpen}
        onClose={() => { setIsPickerOpen(false); setEditingCell(null); }}
        initialValues={editingCell ? (filteredData[editingCell.row]?.certificates || []) : []}
        masterCerts={masterCertificates}
        onSave={(vals: any) => { if (editingCell) handleSaveInternal(filteredData[editingCell.row]?.id, 'certificates', vals); setIsPickerOpen(false); }}
      />
      <MobileDetailModal
        isOpen={!!detailData}
        onClose={() => setDetailData(null)}
        data={detailData}
        columns={columns}
        onSave={handleSaveInternal}
        onAction={onAction}
      />
    </div>
  );
}
