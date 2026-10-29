'use client';

import * as React from 'react';
import { Award, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateMasterCertificates, MasterCertificate } from '@/app/(dashboard)/admin/settings/actions';
import { useRouter } from 'next/navigation';

interface MasterCertificatesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialCertificates: MasterCertificate[];
}

export function MasterCertificatesModal({
  isOpen,
  onOpenChange,
  initialCertificates
}: MasterCertificatesModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [certs, setCerts] = React.useState<MasterCertificate[]>(initialCertificates);
  const [newCertName, setNewCertName] = React.useState('');
  const [newCertLevels, setNewCertLevels] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setCerts(initialCertificates);
    }
  }, [isOpen, initialCertificates]);

  const addCert = () => {
    if (!newCertName.trim()) {
      toast({ variant: 'destructive', title: '자격증 명칭을 입력해주세요.' });
      return;
    }
    if (certs.some(c => c.name.toLowerCase() === newCertName.trim().toLowerCase())) {
      toast({ variant: 'destructive', title: '이미 등록된 자격증입니다.' });
      return;
    }

    const levelsArray = newCertLevels
      ? newCertLevels.split(',').map(l => l.trim()).filter(Boolean)
      : [];

    setCerts(prev => [{ name: newCertName.trim(), levels: levelsArray }, ...prev]);
    setNewCertName('');
    setNewCertLevels('');
    toast({ title: '자격증 추가됨', description: '하단의 "변경사항 최종 저장" 버튼을 눌러야 데이터베이스에 반영됩니다.' });
  };

  const removeCert = (name: string) => {
    setCerts(prev => prev.filter(c => c.name !== name));
  };

  const filteredCerts = certs.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.levels && c.levels.some(l => l.toLowerCase().includes(search.toLowerCase())))
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateMasterCertificates(certs);
      if (res.success) {
        toast({
          title: '마스터 자격증 저장 완료',
          description: `총 ${certs.length}개의 마스터 자격증 정보가 업데이트되었습니다.`
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '자격증 목록을 저장하지 못했습니다.'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err.message || '저장 중 통신 오류가 발생했습니다.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col rounded-2xl p-6">
        <DialogHeader className="space-y-1.5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
            <Award className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-800 tracking-tight">
            자격증 및 급수 마스터 관리
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            학생들이 취득 가능한 공식 자격증 목록과 급수 기준을 등록·관리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2 min-h-0">
          {/* 새 자격증 추가 폼 */}
          <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5">
            <span className="text-xs font-bold text-blue-800">신규 마스터 자격증 추가</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="자격증 명칭 (예: 정보처리기능사)"
                value={newCertName}
                onChange={(e) => setNewCertName(e.target.value)}
                className="h-9 bg-white text-xs rounded-lg border-blue-200 focus:border-blue-500"
              />
              <Input
                placeholder="급수 목록 (쉼표 구분, 예: 1급, 2급)"
                value={newCertLevels}
                onChange={(e) => setNewCertLevels(e.target.value)}
                className="h-9 bg-white text-xs rounded-lg border-blue-200 focus:border-blue-500"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addCert}
              className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> 목록에 추가
            </Button>
          </div>

          {/* 자격증 목록 및 검색 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                등록된 자격증 목록 <span className="text-blue-600">({certs.length}개)</span>
              </span>
              <div className="relative w-44 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="자격증/급수 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg focus:bg-white"
                />
              </div>
            </div>

            {/* 자격증 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto p-2 border rounded-xl bg-slate-50/50">
              {filteredCerts.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-400">
                  {search ? '검색어와 일치하는 자격증이 없습니다.' : '등록된 자격증이 없습니다.'}
                </div>
              ) : (
                filteredCerts.map(cert => (
                  <div
                    key={cert.name}
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs group hover:border-blue-300 transition-all"
                  >
                    <div className="flex flex-col gap-1 min-w-0 pr-2">
                      <span className="font-bold text-xs text-slate-800 truncate">{cert.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {cert.levels && cert.levels.length > 0 ? (
                          cert.levels.map(lvl => (
                            <Badge key={lvl} variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600">
                              {lvl}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">급수 없음</span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCert(cert.name)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-bold"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            변경사항 최종 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
