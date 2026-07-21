'use client'

import * as React from 'react'
import { Search, Award, ChevronRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { normalizeCertificates } from './utils'

export const CertificatePicker = React.memo(({ isOpen, onClose, initialValues, masterCerts, onSave }: any) => {
  const [selected, setSelected] = React.useState<string[]>([])
  const [search, setSearch] = React.useState('')
  const [activeCert, setActiveCert] = React.useState<any | null>(null)

  React.useEffect(() => {
    if (isOpen) { setSelected(normalizeCertificates(initialValues)); setSearch(''); setActiveCert(null); }
  }, [isOpen, initialValues])

  const handleCertClick = (cert: any) => {
    if (cert.levels && cert.levels.length > 0) setActiveCert(cert);
    else setSelected(prev => prev.includes(cert.name) ? prev.filter(c => c !== cert.name) : [...prev, cert.name]);
  }

  const handleLevelSelect = (level: string) => {
    if (!activeCert) return;
    const fullName = activeCert.name.endsWith(')') ? `${activeCert.name} ${level}` : `${activeCert.name}(${level})`;
    setSelected(prev => [...prev.filter(item => item !== activeCert.name && !item.startsWith(`${activeCert.name}(`) && !item.startsWith(`${activeCert.name} `)), fullName]);
    setActiveCert(null);
  }

  const filtered = (masterCerts || []).filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[500px] p-0 overflow-hidden rounded-2xl sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col border-none">
        <DialogHeader className="p-5 sm:p-6 bg-indigo-600 text-white shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2"><Award className="h-5 w-5" /> 자격증 선택</DialogTitle>
          <DialogDescription className="text-indigo-100 text-[10px] sm:text-xs">보유하신 자격증을 선택하세요.</DialogDescription>
        </DialogHeader>
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">현재 선택됨 ({selected.length})</h4>
            <div className="flex flex-wrap gap-1.5 p-3 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50 min-h-[60px] max-h-[120px] overflow-y-auto">
              {selected.length > 0 ? selected.map(s => (
                <Badge key={s} className="bg-white border-indigo-200 text-indigo-700 py-1 pl-2 pr-1 gap-1 shadow-sm">
                  <span>{s}</span>
                  <X className="h-3.5 w-3.5 cursor-pointer text-indigo-300 hover:text-rose-500" onClick={() => setSelected(p => p.filter(x => x !== s))} />
                </Badge>
              )) : <p className="text-xs text-slate-400 italic w-full text-center py-2">선택된 자격증이 없습니다.</p>}
            </div>
          </div>
          {!activeCert ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="자격증 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                {filtered.map((c: any) => {
                  const isAnyLevelSelected = selected.some(s => s === c.name || s.startsWith(`${c.name}(`) || s.startsWith(`${c.name} `));
                  return (
                    <Button key={c.name} variant="outline" size="sm" className={cn("justify-between font-medium group px-3 h-11 rounded-lg", isAnyLevelSelected && "bg-indigo-50 border-indigo-200 text-indigo-700")} onClick={() => handleCertClick(c)}>
                      <span className="truncate text-xs">{c.name}</span>
                      {c.levels?.length > 0 ? <ChevronRight className="h-3 w-3 text-slate-300" /> : (isAnyLevelSelected && <Check className="h-3 w-3 text-indigo-500" />)}
                    </Button>
                  );
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
        <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
          <Button variant="ghost" onClick={onClose} className="h-11">취소</Button>
          <Button onClick={() => onSave(selected)} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 h-11 shadow-lg shadow-indigo-100">저장하기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
});
CertificatePicker.displayName = 'CertificatePicker';
