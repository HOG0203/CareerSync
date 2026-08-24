'use client'

import * as React from 'react'
import { Search, GraduationCap, Trash2, Loader2, Phone, ChevronRight, ChevronLeft, BookUser, Award, Filter, X } from 'lucide-react'

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
  pageType,
  hideCheckbox = pageType === 'students',
  hideSearch = false,
  onFilteredDataChange,
}: SpreadsheetTableProps) {


  const [mounted, setMounted] = React.useState(false)
  const isMobile = useIsMobile()

  // 가로 스크롤 동기화 상태
  const [scrollLeft, setScrollLeft] = React.useState(0)
  const [scrollWidth, setScrollWidth] = React.useState(0)
  const [clientWidth, setClientWidth] = React.useState(0)

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


  // 스크롤 메타데이터 동기화
  const updateScrollMeta = React.useCallback(() => {
    if (containerRef.current) {
      setScrollLeft(containerRef.current.scrollLeft)
      setScrollWidth(containerRef.current.scrollWidth)
      setClientWidth(containerRef.current.clientWidth)
    }
  }, [containerRef])

  React.useEffect(() => {
    updateScrollMeta()
    const timer = setTimeout(updateScrollMeta, 300)
    return () => clearTimeout(timer)
  }, [filteredData, columns, mounted, updateScrollMeta])

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
    setScrollLeft(e.currentTarget.scrollLeft)
    setScrollWidth(e.currentTarget.scrollWidth)
    setClientWidth(e.currentTarget.clientWidth)
  }

  const handleTopScrollChange = (newLeft: number) => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = newLeft
      setScrollLeft(newLeft)
    }
  }

  const handleScrollStep = (dir: 'left' | 'right') => {
    if (containerRef.current) {
      const delta = dir === 'left' ? -350 : 350
      containerRef.current.scrollBy({ left: delta, behavior: 'smooth' })
    }
  }

  React.useEffect(() => {
    onFilteredDataChange?.(filteredData);
  }, [filteredData, onFilteredDataChange]);

  const isColumnFilterActive = Object.values(columnFilters).some(v => Array.isArray(v) && v.length > 0);


  if (!mounted) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full h-full overflow-hidden">
      {/* 선택 툴바 또는 시트 필터 초기화 버튼 (필요할 때만 슬림하게 노출) */}
      {(!hideSearch || selectedRowIds.length > 0 || isColumnFilterActive) && (
        <div className="flex items-center justify-between p-1.5 bg-slate-50/80 rounded-xl border border-slate-200/80 shrink-0">
          <div className="flex items-center gap-2">
            {!hideSearch && (
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                  placeholder={searchPlaceholder}
                  className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
            {isColumnFilterActive && (
              <div className="flex items-center gap-1.5 pl-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleFilterChange('ALL', 'RESET')}
                  className="h-6 px-2 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                >
                  <X className="h-3 w-3 mr-1" /> 시트 열 필터 초기화
                </Button>
              </div>
            )}
          </div>
          {selectedRowIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
              <span className="text-xs font-bold text-blue-700 mr-2">{selectedRowIds.length}명 선택됨</span>
              {onPromote && <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={async () => { const r = await onPromote(selectedRowIds); if (r.success) syncSelected([]); }}><GraduationCap className="h-3.5 w-3.5 mr-1.5" />진급 설정</Button>}
              {onDelete && <Button size="sm" variant="destructive" className="h-8 shadow-md" onClick={async () => { if (confirm('정말 삭제하시겠습니까?')) { const r = await onDelete(selectedRowIds); if (r.success) syncSelected([]); } }}><Trash2 className="h-3.5 w-3.5 mr-1.5" />삭제</Button>}
              <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => syncSelected([])}>선택 취소</Button>
            </div>
          )}
        </div>
      )}



      {/* 데스크톱: 스프레드시트 테이블 (내부 전용 스크롤박스) */}
      {!isMobile ? (
        <div className="flex flex-col flex-1 min-h-0 border rounded-md shadow-inner bg-white overflow-hidden">
          <div ref={containerRef} className="relative outline-none bg-white overflow-auto h-[calc(100vh-210px)] custom-scrollbar focus-visible:ring-0" onScroll={handleTableScroll} onKeyDown={handleKeyDown} tabIndex={0}>
            <table className="text-[11px] border-collapse table-auto min-w-max text-center relative border-none">
              <colgroup>
                {!hideCheckbox && <col style={{ width: 32 }} />}
                {columns.map((c, i) => <col key={i} style={{ width: c.width, minWidth: c.width }} />)}
              </colgroup>
              <TableHeader
                columns={columns}
                groupHeaders={groupHeaders}
                filterOptions={filterOptions}
                columnFilters={columnFilters}
                onFilterChange={handleFilterChange}
                onSelectAll={handleSelectAll}
                isAllSelected={filteredData.length > 0 && filteredData.every(r => selectedRowIds.includes(r.id))}
                hideCheckbox={hideCheckbox}
              />
              <tbody>
                {(() => {
                  const totalCount = filteredData.length;
                  const OVERSCAN = 12;
                  const visStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
                  const visEnd = Math.min(totalCount - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
                  
                  const editRow = editingCell?.row ?? -1;
                  const start = editRow >= 0 && editRow < visStart ? editRow : visStart;
                  const end = editRow > visEnd ? editRow : visEnd;

                  const sMinR = selectionStart && selectionEnd ? Math.min(selectionStart.row, selectionEnd.row) : -1;
                  const sMaxR = selectionStart && selectionEnd ? Math.max(selectionStart.row, selectionEnd.row) : -1;
                  const sMinC = selectionStart && selectionEnd ? Math.min(selectionStart.col, selectionEnd.col) : -1;
                  const sMaxC = selectionStart && selectionEnd ? Math.max(selectionStart.col, selectionEnd.col) : -1;

                  const rows = [];
                  const colSpanCount = columns.length + (hideCheckbox ? 0 : 1);

                  if (start > 0) {
                    rows.push(
                      <tr key="top-spacer" style={{ height: start * ROW_HEIGHT }}>
                        <td colSpan={colSpanCount} className="border-none p-0" />
                      </tr>
                    );
                  }

                  for (let i = start; i <= end; i++) {
                    const row = filteredData[i];
                    if (!row) continue;
                    rows.push(
                      <SpreadsheetRow
                        key={row.id}
                        rIdx={i}
                        row={row}
                        columns={columns}
                        selMinR={sMinR}
                        selMaxR={sMaxR}
                        selMinC={sMinC}
                        selMaxC={sMaxC}
                        selStart={selectionStart}
                        editCell={editingCell}
                        onMouseDown={handleMouseDown}
                        onMouseEnter={handleMouseEnter}
                        onStartEdit={(r: any, c: any) => {
                          if (!columns[c] || columns[c].readOnly || columns[c].type === 'action') return;
                          if (columns[c].type === 'multi-select') {
                            setEditingCell({ row: r, col: c });
                            setIsPickerOpen(true);
                          } else setEditingCell({ row: r, col: c });
                        }}
                        onEndEdit={() => setEditingCell(null)}
                        onSave={handleSaveInternal}
                        isSelectedRow={selectedRowIds.includes(row.id)}
                        onSelectRow={(id: any, v: any) => syncSelected(v ? [...selectedRowIds, id] : selectedRowIds.filter(x => x !== id))}
                        onAction={onAction}
                        rankingMap={rankingMap}
                        isRankingsLoading={isRankingsLoading}
                        userProfile={userProfile}
                        disableNamePopover={disableNamePopover}
                        baseYear={baseYear}
                        hideCheckbox={hideCheckbox}
                      />
                    );
                  }

                  if (end < totalCount - 1) {
                    rows.push(
                      <tr key="bottom-spacer" style={{ height: (totalCount - 1 - end) * ROW_HEIGHT }}>
                        <td colSpan={colSpanCount} className="border-none p-0" />
                      </tr>
                    );
                  }

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 모바일: 페이지 유형별 특화 모바일 카드 목록 */
        <div className="grid grid-cols-1 gap-2.5 lg:hidden p-1 overflow-y-auto">
          {filteredData.map((row) => {
            const titleCol = columns.find(c => c.key.includes('name')) || columns[1];
            const certs = normalizeCertificates(row?.certificates || []);
            const studentName = row.student_name || row[titleCol?.key || ''] || '이름 없음';
            const rawGrade = row.grade || (row.graduation_year ? `${row.graduation_year}졸업` : '');
            const gradeText = rawGrade 
              ? (String(rawGrade).endsWith('학년') || String(rawGrade).endsWith('졸업') 
                  ? String(rawGrade) 
                  : `${rawGrade}학년`) 
              : '';
            const classText = row.class_info ? `${row.class_info}반` : '';
            const numberText = row.student_number ? `${row.student_number}번` : '';
            const subInfoText = [row.major, classText, numberText].filter(Boolean).join(' • ');

            // 페이지 유형 자동 판별
            const effectivePageType = pageType || (
              columns.some(c => c.key === 'counseling_log_action') ? 'class-management' :
              columns.some(c => c.key === 'company' || c.key === 'latest_training_company') ? 'students' :
              'admin-students'
            );

            // 이름 클릭 팝업(StudentPopover) 렌더링 헬퍼
            const renderStudentName = () => {
              if (!disableNamePopover) {
                return (
                  <div onClick={(e) => e.stopPropagation()} className="min-w-0 truncate">
                    <StudentPopover student={row} rankingSummary={rankingMap?.[row.id]} isRankingsLoading={isRankingsLoading} userProfile={userProfile} baseYear={baseYear}>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate hover:text-indigo-600 transition-colors cursor-pointer underline decoration-indigo-300 underline-offset-2">
                        {studentName}
                      </h3>
                    </StudentPopover>
                  </div>
                );
              }
              return <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{studentName}</h3>;
            };

            // ==========================================
            // CASE 1: 학급 관리 (/class-management) - 담임 교사 전용 진로상담 카드
            // ==========================================
            if (effectivePageType === 'class-management') {
              return (
                <div 
                  key={row.id} 
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs active:scale-[0.99] transition-all cursor-pointer hover:border-indigo-200 flex flex-col gap-2.5" 
                  onClick={() => setDetailData(row)}
                >
                  {/* 1행: 아바타 + 이름/반/번호 (좌), 전화번호 & 상담일지 버튼 (우) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 font-extrabold text-xs shrink-0">
                        {String(studentName)[0]}
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {renderStudentName()}
                          <span className="text-[10px] font-bold text-slate-500">
                            {classText} {numberText}
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-600 font-medium truncate mt-0.5">
                          {row.major || '학과 미지정'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {row.phone_number && (
                        <a 
                          href={`tel:${row.phone_number}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50/70 px-1.5 py-1 rounded border border-blue-100/80"
                        >
                          <Phone className="h-3 w-3 text-blue-500" />
                          <span className="hidden sm:inline">{row.phone_number}</span>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-bold text-indigo-700 bg-indigo-50/80 border-indigo-100 hover:bg-indigo-100 px-2 gap-1"
                        onClick={(e) => { e.stopPropagation(); onAction?.(row.id, 'counseling_log_action'); }}
                      >
                        <BookUser className="h-3.5 w-3.5 text-indigo-600" />
                        상담일지
                      </Button>
                    </div>
                  </div>

                  {/* 2행: 담임 상담 핵심 데이터 요약 바 (진로희망, 희망기업, 희망코스, 부모의견) */}
                  <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-200/60 grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">진로희망:</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.2 rounded border truncate", 
                        row.career_aspiration === '취업' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        row.career_aspiration === '진학' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                        row.career_aspiration === '제외인정자' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'text-slate-600 border-slate-200'
                      )}>
                        {row.career_aspiration || '미입력'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">희망기업:</span>
                      <span className="font-bold text-slate-700 truncate text-[10px]">
                        {row.special_notes || '미설정'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">희망코스:</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50/80 px-1 py-0.2 rounded border border-indigo-100/80 text-[10px] truncate">
                        {row.career_course || '미설정'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">부모의견:</span>
                      <span className="font-bold text-slate-700 text-[10px] truncate">
                        {row.parents_opinion || '미선택'}
                      </span>
                    </div>
                  </div>

                  {/* 3행: 자격증 목록 & 상세 보기 */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-400">
                    <div className="flex items-center gap-1 overflow-hidden min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0 mr-1">자격증:</span>
                      {certs.length > 0 ? (
                        <>
                          {certs.slice(0, 3).map((cert, i) => (
                            <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[100px]">
                              {cert}
                            </span>
                          ))}
                          {certs.length > 3 && (
                            <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100/80 shrink-0">
                              +{certs.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-medium italic">자격증 미입력</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 ml-1" />
                  </div>
                </div>
              );
            }

            // ==========================================
            // CASE 2: 학생 취업 현황 (/students) - 취업/현장실습 통합 현황 카드
            // ==========================================
            if (effectivePageType === 'students') {
              const companyName = row.company || row.latest_training_company || '';
              const companyLabel = row.company ? '취업처' : row.latest_training_company ? '실습처' : '';

              return (
                <div 
                  key={row.id} 
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs active:scale-[0.99] transition-all cursor-pointer hover:border-indigo-200 flex flex-col gap-2.5" 
                  onClick={() => setDetailData(row)}
                >
                  {/* 1행: 아바타 + 이름 + 학년 + 학과/반/번호 (좌), 전화번호 & 취업상태 배지 (우) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 font-extrabold text-xs shrink-0">
                        {String(studentName)[0]}
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {renderStudentName()}
                          {gradeText && (
                            <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded border border-indigo-100/80 shrink-0">
                              {gradeText}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {subInfoText || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      {row.phone_number && (
                        <a 
                          href={`tel:${row.phone_number}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50/70 px-1.5 py-0.5 rounded border border-blue-100/80"
                        >
                          <Phone className="h-3 w-3 text-blue-500" />
                          {row.phone_number}
                        </a>
                      )}
                      {row.business_type && (
                        <Badge className={cn("text-[10px] px-1.5 py-0.5 font-bold", 
                          row.business_type === '취업' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          row.business_type === '현장실습중' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          row.business_type === '미취업' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        )}>
                          {row.business_type}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 2행: 취업처/실습처 회사명, 기업구분, 최종진로코스 및 실습이력 버튼 */}
                  <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-200/60 flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{companyLabel || '회사'}:</span>
                        <span className="font-extrabold text-slate-900 truncate">{companyName || '미등록'}</span>
                        {row.company_type && (
                          <span className="text-[9px] font-bold bg-white text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                            {row.company_type}
                          </span>
                        )}
                      </div>

                      {onAction && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 gap-1 shrink-0"
                          onClick={(e) => { e.stopPropagation(); onAction(row.id, 'field_training_action'); }}
                        >
                          <Award className="h-3 w-3 text-emerald-600" />
                          실습이력
                        </Button>
                      )}
                    </div>

                    {row.employment_status && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">최종진로코스:</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-100/80 text-[10px]">
                          {row.employment_status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 3행: 자격증 목록 & 상세 보기 */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-400">
                    <div className="flex items-center gap-1 overflow-hidden min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0 mr-1">자격증:</span>
                      {certs.length > 0 ? (
                        <>
                          {certs.slice(0, 3).map((cert, i) => (
                            <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[100px]">
                              {cert}
                            </span>
                          ))}
                          {certs.length > 3 && (
                            <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100/80 shrink-0">
                              +{certs.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-medium italic">자격증 미입력</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 ml-1" />
                  </div>
                </div>
              );
            }

            // ==========================================
            // CASE 3: 관리자 학생 등록/진급 (/admin/students) - 초슬림 인적사항 명부 카드
            // ==========================================
            return (
              <div 
                key={row.id} 
                className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs active:scale-[0.99] transition-all cursor-pointer hover:border-indigo-200 flex flex-col gap-2" 
                onClick={() => setDetailData(row)}
              >
                {/* 상단: 이름 + 학년 + 학과/반/번호 (좌), 전화번호 (우) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 font-extrabold text-xs shrink-0">
                      {String(studentName)[0]}
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {renderStudentName()}
                        {gradeText && (
                          <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded border border-indigo-100/80 shrink-0">
                            {gradeText}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {subInfoText || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    {row.phone_number && (
                      <a 
                        href={`tel:${row.phone_number}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50/70 px-1.5 py-0.5 rounded border border-blue-100/80"
                      >
                        <Phone className="h-3 w-3 text-blue-500" />
                        {row.phone_number}
                      </a>
                    )}
                  </div>
                </div>

                {/* 하단: 자격증 목록 & 상세 보기 */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-400">
                  <div className="flex items-center gap-1 overflow-hidden min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0 mr-1">자격증:</span>
                    {certs.length > 0 ? (
                      <>
                        {certs.slice(0, 3).map((cert, i) => (
                          <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[110px]">
                            {cert}
                          </span>
                        ))}
                        {certs.length > 3 && (
                          <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100/80 shrink-0">
                            +{certs.length - 3}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-medium italic">자격증 미입력</span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 ml-1" />
                </div>
              </div>
            );
          })}
          {filteredData.length === 0 && <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><p className="text-xs text-slate-400">검색 결과가 없습니다.</p></div>}
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
