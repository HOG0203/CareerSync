'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { SpreadsheetCell } from './spreadsheet-cell'

export const SpreadsheetRow = React.memo(({ row, rIdx, columns, selMinR, selMaxR, selMinC, selMaxC, selStart, editCell, onMouseDown, onMouseEnter, onStartEdit, onEndEdit, onSave, isSelectedRow, onSelectRow, onAction, rankingMap, isRankingsLoading, userProfile, disableNamePopover, baseYear, hideCheckbox }: any) => {
  const isRowInSelection = rIdx >= selMinR && rIdx <= selMaxR;
  return (
    <tr className={cn("h-8 transition-none hover:bg-slate-50/50", isSelectedRow && "bg-blue-50/30")}>
      {!hideCheckbox && (
        <td className="border-r border-b w-8 p-0 bg-white"><div className="flex items-center justify-center h-8"><Checkbox checked={isSelectedRow} onCheckedChange={(val) => onSelectRow(row.id, !!val)} /></div></td>
      )}
      {columns.map((col: any, cIdx: number) => (
        <SpreadsheetCell key={col.key} id={row.id} field={col.key} value={row[col.key]} config={col} rowData={row} rIdx={rIdx} cIdx={cIdx} isSelected={isRowInSelection && cIdx >= selMinC && cIdx <= selMaxC} isFocused={selStart?.row === rIdx && selStart?.col === cIdx} isEditing={editCell?.row === rIdx && editCell?.col === cIdx} onMouseDown={(m: any) => onMouseDown(rIdx, cIdx, m)} onMouseEnter={() => onMouseEnter(rIdx, cIdx)} onStartEdit={() => onStartEdit(rIdx, cIdx)} onEndEdit={onEndEdit} onSave={onSave} onAction={onAction} rankingMap={rankingMap} isRankingsLoading={isRankingsLoading} userProfile={userProfile} disableNamePopover={disableNamePopover} baseYear={baseYear} />
      ))}
    </tr>
  );
}, (p, n) => {
  if (p.rIdx !== n.rIdx || p.row !== n.row || p.isSelectedRow !== n.isSelectedRow || p.rankingMap !== n.rankingMap || p.isRankingsLoading !== n.isRankingsLoading || p.userProfile !== n.userProfile || p.disableNamePopover !== n.disableNamePopover || p.baseYear !== n.baseYear || p.hideCheckbox !== n.hideCheckbox) return false;
  const wasIn = p.rIdx >= p.selMinR && p.rIdx <= p.selMaxR;
  const isIn = n.rIdx >= n.selMinR && n.rIdx <= n.selMaxR;
  if (wasIn !== isIn || (isIn && (p.selMinC !== n.selMinC || p.selMaxC !== n.selMaxC))) return false;
  if ((p.selStart?.row === p.rIdx) !== (n.selStart?.row === n.rIdx)) return false;
  if ((p.editCell?.row === p.rIdx) !== (n.editCell?.row === n.rIdx)) return false;
  return true;
});
SpreadsheetRow.displayName = 'SpreadsheetRow';
