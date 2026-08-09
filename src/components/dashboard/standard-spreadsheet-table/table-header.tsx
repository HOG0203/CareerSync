'use client'

import * as React from 'react'
import { ListFilter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export const TableHeader = React.memo(({ columns, groupHeaders, filterOptions, columnFilters, onFilterChange, onSelectAll, isAllSelected }: any) => {
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
        {columns.map((col: any) => {
          const isFilterActive = columnFilters[col.key] !== undefined;
          return (
            <th key={col.key} className={cn("sticky z-40 group text-center border-r border-b font-semibold p-0 hover:bg-slate-100 bg-slate-50 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]", hasGroup ? "top-10" : "top-0")} style={{ minWidth: col.width, width: col.width }}>
              <div className="flex items-center justify-center px-1.5 gap-0.5 h-full min-h-[40px] overflow-hidden">
                <span className={cn("leading-tight py-1 select-none", col.label?.includes('\n') ? "whitespace-pre-line" : "whitespace-nowrap")}>{col.label}</span>
                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "p-0.5 rounded transition-opacity",
                      isFilterActive
                        ? "opacity-100 text-blue-600 bg-blue-50"
                        : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    )}>
                      <ListFilter className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0 z-[50]" align="start">
                    <div className="flex items-center justify-between p-1.5 border-b gap-1 bg-slate-50 select-none">
                      <Button variant="ghost" className="h-6 text-[10px] flex-1 px-1 font-bold text-blue-600 hover:text-blue-700" onClick={() => onFilterChange(col.key, 'SELECT_ALL')}>모두 선택</Button>
                      <div className="w-[1px] h-3 bg-slate-200" />
                      <Button variant="ghost" className="h-6 text-[10px] flex-1 px-1 font-bold text-rose-600 hover:text-rose-700" onClick={() => onFilterChange(col.key, 'CLEAR_ALL')}>모두 해제</Button>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {(filterOptions[col.key] || []).map((val: any) => {
                        const isChecked = isFilterActive
                          ? columnFilters[col.key].includes(String(val))
                          : true;
                        return (
                          <div key={String(val)} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-sm cursor-pointer" onClick={() => onFilterChange(col.key, String(val))}>
                            <Checkbox checked={isChecked} />
                            <label className="text-[11px] cursor-pointer flex-1 truncate">{String(val)}</label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-1 border-t"><Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={() => onFilterChange(col.key, 'RESET')}>필터 해제</Button></div>
                  </PopoverContent>
                </Popover>
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
});
TableHeader.displayName = 'TableHeader';
