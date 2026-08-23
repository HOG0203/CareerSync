'use client'

import * as React from 'react'
import { Search, Award, ChevronRight, Check, X, Sparkles, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { normalizeCertificates } from './utils'

export const CertificatePicker = React.memo(({ 
  isOpen, 
  onClose, 
  initialValues, 
  masterCerts, 
  onSave,
  title,
  description,
  isSaving = false
}: any) => {
  const [selected, setSelected] = React.useState<string[]>([])
  const [search, setSearch] = React.useState('')
  const [activeCert, setActiveCert] = React.useState<any | null>(null)

  React.useEffect(() => {
    if (isOpen) { 
      setSelected(normalizeCertificates(initialValues)); 
      setSearch(''); 
      setActiveCert(null); 
    }
  }, [isOpen, initialValues])

  const formatCertFullName = (certName: string, level: string) => {
    if (!level || level === '단일등급' || level === '단일') return certName;
    if (
      certName.endsWith(')') || 
      certName.includes('디지털정보활용능력') ||
      level.includes('-') || 
      level.startsWith('고급') || 
      level.startsWith('중급') || 
      level.startsWith('초급') || 
      level.includes('등급')
    ) {
      return `${certName} ${level}`;
    }
    return `${certName}(${level})`;
  };

  const handleCertClick = (cert: any) => {
    if (cert.levels && cert.levels.length > 0) {
      setActiveCert(cert);
    } else {
      setSelected(prev => prev.includes(cert.name) ? prev.filter(c => c !== cert.name) : [...prev, cert.name]);
    }
  }

  const handleLevelSelect = (level: string) => {
    if (!activeCert) return;
    const fullName = formatCertFullName(activeCert.name, level);
    
    setSelected(prev => {
      // 이미 선택되어 있으면 제거 (토글)
      if (prev.includes(fullName)) {
        return prev.filter(item => item !== fullName);
      }
      
      // 디지털정보활용능력, ITQ 등 하위 종목/과목이 여러 개인 자격증은 다중 선택 허용
      const isMultiSubject = 
        level.includes('-') || 
        activeCert.name.includes('디지털') || 
        activeCert.name.includes('ITQ');

      if (isMultiSubject) {
        return [...prev, fullName];
      } else {
        // 단일 등급(1급 vs 2급 등) 자격증은 동일 자격증의 다른 등급 교체
        const filtered = prev.filter(item => 
          item !== activeCert.name && 
          !item.startsWith(`${activeCert.name}(`) && 
          !item.startsWith(`${activeCert.name} `)
        );
        return [...filtered, fullName];
      }
    });
  };

  const filtered = (masterCerts || []).filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="w-[95vw] max-w-[540px] p-0 overflow-hidden rounded-2xl shadow-2xl max-h-[90vh] flex flex-col border border-slate-200 bg-white">
        <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/80 shadow-2xs shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {title || "자격증 선택 및 등록"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                  {description || "취득한 자격증을 검색하고 등급을 선택하세요."}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-xs px-2.5 py-1 shrink-0">
              선택됨 {selected.length}개
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/60 custom-scrollbar">
          {/* 현재 선택된 자격증 영역 */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                <Check className="h-3.5 w-3.5 text-indigo-600" />
                선택된 자격증 목록 ({selected.length})
              </h4>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
                >
                  전체 해제
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/80 rounded-lg border border-slate-200/70 min-h-[50px] max-h-[110px] overflow-y-auto items-center">
              {selected.length > 0 ? (
                selected.map(s => (
                  <Badge 
                    key={s} 
                    className="bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-800 py-1 pl-2.5 pr-1.5 gap-1.5 shadow-2xs text-xs font-bold rounded-lg"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => setSelected(p => p.filter(x => x !== s))}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-slate-400 font-medium w-full text-center py-2">
                  선택된 자격증이 없습니다. 아래 목록에서 선택하세요.
                </p>
              )}
            </div>
          </div>

          {/* 자격증 검색 및 목록 */}
          {!activeCert ? (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="자격증 명칭 검색 (예: 전기, 컴퓨터, ITQ, 디지털...)" 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="pl-9 h-10 border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-0.5 custom-scrollbar">
                {filtered.map((c: any) => {
                  const isAnyLevelSelected = selected.some(s => s === c.name || s.startsWith(`${c.name}(`) || s.startsWith(`${c.name} `));
                  const selectedCountForCert = selected.filter(s => s === c.name || s.startsWith(`${c.name}(`) || s.startsWith(`${c.name} `)).length;
                  return (
                    <Button 
                      key={c.name} 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className={cn(
                        "justify-between font-bold text-xs group px-3 h-10 rounded-xl border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all", 
                        isAnyLevelSelected && "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                      )} 
                      onClick={() => handleCertClick(c)}
                    >
                      <span className="truncate">{c.name}</span>
                      {c.levels?.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-normal">
                          {selectedCountForCert > 0 ? (
                            <Badge className="bg-indigo-600 text-white font-extrabold text-[9px] px-1.5 py-0 h-4">
                              {selectedCountForCert}개
                            </Badge>
                          ) : (
                            <span>등급선택</span>
                          )}
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </span>
                      ) : (
                        isAnyLevelSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />
                      )}
                    </Button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-slate-400 font-medium">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 등급 선택 화면 */
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-4 animate-in fade-in slide-in-from-right-2 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{activeCert.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">취득하신 종목 및 등급을 클릭하여 선택하세요. (다중 선택 가능)</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveCert(null)} 
                  className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  <X className="h-4 w-4 mr-1" />
                  목록으로
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-0.5 custom-scrollbar pt-1">
                {activeCert.levels.map((level: string) => {
                  const fullName = formatCertFullName(activeCert.name, level);
                  const isThisLevelSelected = selected.includes(fullName);
                  return (
                    <Button 
                      key={level} 
                      type="button"
                      variant="outline" 
                      className={cn(
                        "h-11 text-xs font-bold border-slate-200 rounded-xl transition-all hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 flex items-center justify-between px-3.5",
                        isThisLevelSelected && "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:text-white shadow-xs"
                      )} 
                      onClick={() => handleLevelSelect(level)}
                    >
                      <span className="truncate">{level}</span>
                      {isThisLevelSelected && <Check className="h-4 w-4 shrink-0" />}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-end gap-2 shrink-0">
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            disabled={isSaving}
            onClick={onClose} 
            className="text-xs h-9 font-bold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg px-4"
          >
            취소
          </Button>
          <Button 
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => onSave(selected)} 
            className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-5 shadow-2xs gap-1.5"
          >
            <Check className="h-4 w-4" />
            <span>{isSaving ? "저장 중..." : `선택 완료 (${selected.length})`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
});
CertificatePicker.displayName = 'CertificatePicker';

