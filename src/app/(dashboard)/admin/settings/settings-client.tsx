'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, 
  X, 
  Save, 
  Settings2, 
  Calendar, 
  Award, 
  Layers, 
  Loader2, 
  Trophy, 
  Search, 
  GraduationCap, 
  Scale, 
  Sparkles, 
  ShieldAlert, 
  RotateCcw, 
  Trash2,
  Camera,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { 
  updateMasterCertificates, 
  updateSystemSettings, 
  updateCertificationConfig, 
  updateMeritDemeritRules, 
  getDefaultMeritDemeritRules, 
  getGradeStudentCounts,
  createAcademicSnapshotAction,
  getAcademicSnapshotsAction,
  deleteAcademicSnapshotAction,
  restoreAcademicSnapshotAction,
  downloadSnapshotExcelAction,
  downloadCurrentYearExcelAction,
  MasterCertificate, 
  CertificationConfig, 
  MeritDemeritRule 
} from './actions';
import { updateAchievementScores } from '../grades/actions';
import { AcademicSnapshotItem } from '@/lib/academic-snapshots';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface AdminSettingsClientProps {
  initialBaseYear: number;
  initialCerts: MasterCertificate[];
  initialCertConfig: CertificationConfig;
  initialMeritRules: MeritDemeritRule[];
  initialSnapshots?: AcademicSnapshotItem[];
  initialGradeCounts?: { grade1: number; grade2: number; grade3: number; total: number };
}

export function AdminSettingsClient({
  initialBaseYear,
  initialCerts,
  initialCertConfig,
  initialMeritRules,
  initialSnapshots = [],
  initialGradeCounts = { grade1: 0, grade2: 0, grade3: 0, total: 0 },
}: AdminSettingsClientProps) {
  const [certs, setCerts] = React.useState<MasterCertificate[]>(initialCerts);
  const [baseYear, setBaseYear] = React.useState<number>(initialBaseYear);
  const [certConfig, setCertConfig] = React.useState<CertificationConfig>(initialCertConfig);
  const [achievementWeights, setAchievementWeights] = React.useState<Record<string, number>>(
    initialCertConfig.gradeWeights || { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 }
  );
  const [meritRules, setMeritRules] = React.useState<MeritDemeritRule[]>(initialMeritRules);

  // 스냅샷 및 학년별 재학생 상태
  const [snapshots, setSnapshots] = React.useState<AcademicSnapshotItem[]>(initialSnapshots);
  const [selectedSnapshotId, setSelectedSnapshotId] = React.useState<string>(
    initialSnapshots && initialSnapshots.length > 0 ? initialSnapshots[0].id : ''
  );
  const [gradeCounts, setGradeCounts] = React.useState<{ grade1: number; grade2: number; grade3: number; total: number }>(initialGradeCounts);
  const [isLoadingGradeCounts, setIsLoadingGradeCounts] = React.useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = React.useState(false);
  const [isDownloadingLiveExcel, setIsDownloadingLiveExcel] = React.useState(false);
  const [isDownloadingSnapshotExcel, setIsDownloadingSnapshotExcel] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const [activeCertTab, setActiveCertTab] = React.useState<'grades' | 'attendance' | 'certificates'>('grades');
  const [newCertName, setNewCertName] = React.useState('');
  const [newCertLevels, setNewCertLevels] = React.useState('');
  const [certSearch, setCertSearch] = React.useState('');

  const [activeMeritTab, setActiveMeritTab] = React.useState<'merit' | 'demerit'>('merit');
  const [newRuleName, setNewRuleName] = React.useState('');
  const [newRuleCategory, setNewRuleCategory] = React.useState('');
  const [newRulePoints, setNewRulePoints] = React.useState(1);
  const [newRuleType, setNewRuleType] = React.useState<'merit' | 'demerit'>('merit');

  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  // 기준학사년도 변경 시 실시간 학년별 인원수 재계산
  const handleBaseYearChange = async (val: string) => {
    const newYear = parseInt(val);
    setBaseYear(newYear);
    setIsLoadingGradeCounts(true);
    try {
      const counts = await getGradeStudentCounts(newYear);
      setGradeCounts(counts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingGradeCounts(false);
    }
  };

  // Base64 문자열을 Excel 파일로 즉시 다운로드 트리거
  const triggerBase64Download = (base64: string, filename: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 스냅샷 생성 핸들러
  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const defaultName = `${baseYear}학년도 학적 및 취업이력 최종 마감 백업`;
      const res = await createAcademicSnapshotAction(baseYear, defaultName);
      if (res.error) {
        toast({ variant: 'destructive', title: '스냅샷 생성 실패', description: res.error });
      } else {
        toast({
          title: '마감 스냅샷 백업 완료',
          description: `${baseYear}학년도 전교생 ${res.count}명의 데이터가 안전하게 동결 보관되었습니다.`,
        });
        const updatedList = await getAcademicSnapshotsAction();
        setSnapshots(updatedList);
        if (updatedList.length > 0) {
          setSelectedSnapshotId(updatedList[0].id);
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '스냅샷 생성 오류', description: e.message });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  // 실시간 전교생 엑셀 다운로드 핸들러
  const handleDownloadCurrentYearExcel = async () => {
    setIsDownloadingLiveExcel(true);
    try {
      const res = await downloadCurrentYearExcelAction(baseYear);
      if (res.error || !res.base64 || !res.filename) {
        toast({ variant: 'destructive', title: '엑셀 다운로드 실패', description: res.error || '데이터 없음' });
      } else {
        triggerBase64Download(res.base64, res.filename);
        toast({ title: '엑셀 다운로드 완료', description: `${res.filename} 파일이 다운로드되었습니다.` });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '엑셀 추출 오류', description: e.message });
    } finally {
      setIsDownloadingLiveExcel(false);
    }
  };

  // 선택된 스냅샷 엑셀 다운로드 핸들러
  const handleDownloadSelectedSnapshotExcel = async () => {
    if (!selectedSnapshotId) return;
    setIsDownloadingSnapshotExcel(true);
    try {
      const res = await downloadSnapshotExcelAction(selectedSnapshotId);
      if (res.error || !res.base64 || !res.filename) {
        toast({ variant: 'destructive', title: '엑셀 다운로드 실패', description: res.error || '데이터 없음' });
      } else {
        triggerBase64Download(res.base64, res.filename);
        toast({ title: '스냅샷 엑셀 다운로드 완료', description: `${res.filename} 파일이 다운로드되었습니다.` });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '엑셀 다운로드 오류', description: e.message });
    } finally {
      setIsDownloadingSnapshotExcel(false);
    }
  };

  // 스냅샷 원상 복원 핸들러
  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshotId) return;
    setIsRestoring(true);
    try {
      const res = await restoreAcademicSnapshotAction(selectedSnapshotId);
      if (res.error) {
        toast({ variant: 'destructive', title: '복원 실패', description: res.error });
      } else {
        toast({
          title: '스냅샷 복원 완료',
          description: `${res.snapshotName} 시점으로 전교생 ${res.restoredCount}명의 데이터가 원상 복원되었습니다.`,
        });
        setIsRestoreDialogOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '복원 오류', description: e.message });
    } finally {
      setIsRestoring(false);
    }
  };

  // 스냅샷 삭제 핸들러
  const handleDeleteSnapshot = async () => {
    if (!selectedSnapshotId) return;
    setIsDeleting(true);
    try {
      const res = await deleteAcademicSnapshotAction(selectedSnapshotId);
      if (res.error) {
        toast({ variant: 'destructive', title: '삭제 실패', description: res.error });
      } else {
        toast({ title: '스냅샷 삭제 완료', description: '선택하신 마감 백업이 안전하게 영구 삭제되었습니다.' });
        setIsDeleteDialogOpen(false);
        const nextList = snapshots.filter(s => s.id !== selectedSnapshotId);
        setSnapshots(nextList);
        setSelectedSnapshotId(nextList.length > 0 ? nextList[0].id : '');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '삭제 오류', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const addCert = () => {
    const name = newCertName.trim();
    if (name && !certs.find(c => c.name === name)) {
      const levels = newCertLevels.split(',').map(l => l.trim()).filter(Boolean);
      setCerts([...certs, { name, levels }].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
      setNewCertName('');
      setNewCertLevels('');
    }
  };

  const removeCert = (name: string) => {
    setCerts(certs.filter(c => c.name !== name));
  };

  const addMeritRule = () => {
    const name = newRuleName.trim();
    if (!name) {
      toast({ variant: 'destructive', title: '항목명을 입력하세요.' });
      return;
    }
    const newRule: MeritDemeritRule = {
      id: `rule-${Date.now()}`,
      type: newRuleType,
      category: newRuleCategory.trim() || (newRuleType === 'merit' ? '기본생활' : '기타'),
      name,
      points: Math.max(1, Math.min(1000, newRulePoints)),
      isActive: true,
      order: meritRules.length + 1
    };
    setMeritRules(prev => [...prev, newRule]);
    setNewRuleName('');
    setNewRuleCategory('');
    toast({ title: '항목 추가됨', description: `[${newRuleType === 'merit' ? '상점' : '벌점'}] ${name} (${newRule.points}점) 항목이 추가되었습니다. (전체 설정 저장 필요)` });
  };

  const removeMeritRule = (id: string) => {
    setMeritRules(prev => prev.filter(r => r.id !== id));
  };

  const resetMeritRulesToDefault = async () => {
    const defaultRules = await getDefaultMeritDemeritRules();
    setMeritRules(defaultRules);
    toast({ title: '기본값 복구', description: '표준 고교 상벌점 기준 항목으로 재설정되었습니다. (전체 설정 저장 필요)' });
  };

  const handleSaveAll = async () => {
    setIsPending(true);
    try {
      const fullCertConfig: CertificationConfig = {
        ...certConfig,
        gradeWeights: achievementWeights,
      };

      const [certResult, settingsResult, weightResult, certConfigResult, meritResult] = await Promise.all([
        updateMasterCertificates(certs),
        updateSystemSettings({ baseYear }),
        updateAchievementScores(achievementWeights),
        updateCertificationConfig(fullCertConfig),
        updateMeritDemeritRules(meritRules)
      ]);

      if (certResult.success && settingsResult.success && weightResult.success && certConfigResult.success && meritResult.success) {
        toast({ title: '설정 저장 완료', description: '모든 시스템 설정(학사학년도, 상벌점 기준, 성적, 출결, 자격증 포함)이 갱신되었습니다.' });
      } else {
        toast({ 
          variant: 'destructive', 
          title: '저장 실패', 
          description: certResult.error || settingsResult.error || (weightResult as any).error || certConfigResult.error || meritResult.error
        });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: '저장 중 오류 발생' });
    } finally {
      setIsPending(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const filteredCerts = React.useMemo(() => {
    if (!certSearch.trim()) return certs;
    const query = certSearch.trim().toLowerCase();
    return certs.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.levels.some(l => l.toLowerCase().includes(query))
    );
  }, [certs, certSearch]);

  {/* 공통 1: 학사학년도 및 마감·안전 백업 관리 콘텐츠 */}
  const renderYearSettingsContent = () => {
    const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId);

    return (
      <div className="space-y-6">
        {/* [섹션 1] 시스템 기준 학사학년도 & 1·2·3학년 재학생 현황 */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>1. 시스템 기준 학사학년도</span>
                <Badge variant="outline" className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200 ml-1">
                  2026 ↔ 2027 양방향 자유 전환 가능
                </Badge>
              </label>
              <p className="text-xs text-slate-500 font-medium">
                선택한 학년도를 기준으로 1·2·3학년 및 졸업생 구분이 실시간 자동 산출됩니다.
              </p>
            </div>

            <div className="w-full sm:w-52 shrink-0">
              <Select value={baseYear.toString()} onValueChange={handleBaseYearChange}>
                <SelectTrigger className="w-full h-11 border-2 border-blue-200 hover:border-blue-400 rounded-xl bg-white text-blue-900 font-black shadow-2xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()} className="font-bold text-xs sm:text-sm">
                      {y}학년도 {y === initialBaseYear ? '(현재 운영중)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 학년별 재학생 현황 카드 3열 */}
          <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs text-center font-medium">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[11px] font-semibold block">3학년 ({baseYear + 1}년 졸업)</span>
              <span className="text-sm sm:text-base font-black text-indigo-700 mt-0.5 block">
                {isLoadingGradeCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-indigo-500" /> : `${gradeCounts.grade3}명`}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[11px] font-semibold block">2학년 ({baseYear + 2}년 졸업)</span>
              <span className="text-sm sm:text-base font-black text-indigo-700 mt-0.5 block">
                {isLoadingGradeCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-indigo-500" /> : `${gradeCounts.grade2}명`}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[11px] font-semibold block">1학년 ({baseYear + 3}년 졸업)</span>
              <span className="text-sm sm:text-base font-black text-indigo-700 mt-0.5 block">
                {isLoadingGradeCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-indigo-500" /> : `${gradeCounts.grade1}명`}
              </span>
            </div>
          </div>
        </div>

        {/* [섹션 2] 🛡️ 학사학년도 마감 안전 백업 (사용자 직접 실행) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-purple-50/40 border-2 border-indigo-200/80 shadow-xs space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[11px] font-black uppercase tracking-wider">
                사용자 직접 실행
              </span>
              <h3 className="text-sm sm:text-base font-black text-indigo-950 flex items-center gap-1.5">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-600" />
                <span>2. 학사학년도 마감 안전 백업</span>
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              새 학년도로 넘어가기 전, 현재 <strong>{baseYear}학년도 전교생 {gradeCounts.total}명의 모든 데이터</strong>(인적사항, 성적, 출결, 취업이력, 현장실습, 학적변동, 상담일지)를 시스템 보존 금고에 100% 동결 백업하고, PC 소장용 통합 엑셀을 즉시 내려받습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <Button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={isCreatingSnapshot}
              className="flex-1 h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-200 gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              {isCreatingSnapshot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              <span>📸 {baseYear}학년도 최종 마감 스냅샷 백업 생성</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadCurrentYearExcel}
              disabled={isDownloadingLiveExcel}
              className="h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-700 font-extrabold border-2 border-emerald-300 hover:border-emerald-400 rounded-xl text-xs sm:text-sm shadow-2xs gap-2 cursor-pointer transition-all active:scale-[0.98] shrink-0"
            >
              {isDownloadingLiveExcel ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
              <span>내 PC 보관용 통합 엑셀 다운로드</span>
            </Button>
          </div>
        </div>

        {/* [섹션 3] 📦 보관된 마감 백업 관리 (드롭다운 방식 ✨) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-purple-600" />
              <span>3. 보관된 마감 백업 관리</span>
              <span className="text-xs text-indigo-600 font-bold">(드롭다운 선택 방식)</span>
            </label>
            <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
              총 {snapshots.length}건 보관 중
            </span>
          </div>

          {/* 드롭다운 셀렉트 */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 block">보관된 백업 목록 선택:</span>
            {snapshots.length === 0 ? (
              <div className="h-11 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-semibold">
                보관된 마감 백업이 없습니다. 상단의 [스냅샷 백업 생성] 버튼을 눌러 백업을 만들어보세요.
              </div>
            ) : (
              <Select value={selectedSnapshotId} onValueChange={setSelectedSnapshotId}>
                <SelectTrigger className="w-full h-11 border-slate-200 hover:border-slate-300 rounded-xl bg-white font-bold text-xs sm:text-sm text-slate-800 shadow-2xs">
                  <SelectValue placeholder="보관된 마감 백업을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {snapshots.map(s => (
                    <SelectItem key={s.id} value={s.id} className="font-semibold text-xs sm:text-sm py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800">{s.snapshot_name}</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          ({s.student_count}명 | {s.created_at.slice(0, 10)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 선택한 백업 3대 액션 버튼 (엑셀 받기, 비상 복원, 영구 삭제) */}
          {selectedSnapshot && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-slate-500 font-medium">
                선택됨: <strong className="text-slate-800">{selectedSnapshot.snapshot_name}</strong> (생성자: {selectedSnapshot.created_by})
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadSelectedSnapshotExcel}
                  disabled={isDownloadingSnapshotExcel}
                  className="h-9 px-3 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 rounded-xl gap-1.5 cursor-pointer"
                >
                  {isDownloadingSnapshotExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-600" />}
                  <span>엑셀 받기</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsRestoreDialogOpen(true)}
                  disabled={isRestoring}
                  className="h-9 px-3 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 rounded-xl gap-1.5 cursor-pointer"
                >
                  {isRestoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
                  <span>복원</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className="h-9 px-3 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 rounded-xl gap-1.5 cursor-pointer"
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-rose-600" />}
                  <span>삭제</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* [섹션 4] 🚀 새 학년도 시작 5단계 가이드 위저드 (친절한 매뉴얼) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <span>4. 학사학년도 전환 안심 진행 5단계 매뉴얼</span>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                단계별 순서대로 진행
              </span>
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
            {/* 1단계 */}
            <div className="p-3 rounded-xl bg-white border-2 border-emerald-400 shadow-2xs space-y-1 relative">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">✓</span>
              <span className="font-extrabold text-slate-800 block text-xs">1단계: 마감 백업</span>
              <p className="text-[11px] text-slate-500 leading-snug">스냅샷 생성 및 엑셀 다운로드</p>
              <span className="inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">직접 실행</span>
            </div>

            {/* 2단계 */}
            <div className="p-3 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
              <span className="font-extrabold text-blue-900 block text-xs">2단계: 학년도 변경</span>
              <p className="text-[11px] text-slate-500 leading-snug">2026 → 2027 드롭다운 변경 후 저장</p>
              <span className="inline-block text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">상단 드롭다운</span>
            </div>

            {/* 3단계 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">3</span>
              <span className="font-extrabold text-slate-800 block text-xs">3단계: 일괄 진급</span>
              <p className="text-[11px] text-slate-500 leading-snug">재학생 새 반·번호 엑셀 업로드</p>
              <a href="/admin/students" target="_blank" className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 font-bold hover:underline">
                <span>학생 관리 이동</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {/* 4단계 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">4</span>
              <span className="font-extrabold text-slate-800 block text-xs">4단계: 신입생 등록</span>
              <p className="text-[11px] text-slate-500 leading-snug">신입생(1학년) 명단 엑셀 등록</p>
              <a href="/admin/students" target="_blank" className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 font-bold hover:underline">
                <span>학생 등록 이동</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {/* 5단계 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">5</span>
              <span className="font-extrabold text-slate-800 block text-xs">5단계: 담임 배정</span>
              <p className="text-[11px] text-slate-500 leading-snug">선생님별 신규 학년/반 권한 갱신</p>
              <a href="/admin/users" target="_blank" className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 font-bold hover:underline">
                <span>교사 관리 이동</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  {/* 공통 2: 자격증 마스터 콘텐츠 */}
  const renderCertSettingsContent = () => (
    <div className="space-y-5">
      {/* 추가 폼 */}
      <div className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-2xl bg-blue-50/30 border border-blue-100/50">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-blue-700">자격증 명칭</label>
            <Input 
              placeholder="예: 컴퓨터활용능력" 
              value={newCertName}
              onChange={(e) => setNewCertName(e.target.value)}
              className="h-10 sm:h-11 bg-white border-slate-200 rounded-xl text-xs sm:text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-blue-700">급수 목록 (쉼표 구분)</label>
            <Input 
              placeholder="예: 1급, 2급, 3급" 
              value={newCertLevels}
              onChange={(e) => setNewCertLevels(e.target.value)}
              className="h-10 sm:h-11 bg-white border-slate-200 rounded-xl text-xs sm:text-sm"
            />
          </div>
          <Button onClick={addCert} className="w-full h-10 sm:h-11 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-100">
            <Plus className="h-4 w-4 mr-1.5 shrink-0" /> 자격증 추가하기
          </Button>
        </div>
      </div>

      {/* 자격증 필터 검색 및 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-700">등록된 마스터 자격증 ({certs.length}개)</label>
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="자격증 검색..."
              value={certSearch}
              onChange={(e) => setCertSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg focus:bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:max-h-[320px] sm:overflow-y-auto pr-1">
          {filteredCerts.map((cert) => (
            <div 
              key={cert.name} 
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all shadow-2xs group"
            >
              <div className="flex flex-col gap-1 min-w-0 pr-2">
                <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">{cert.name}</span>
                <div className="flex flex-wrap gap-1">
                  {cert.levels.map((lvl) => (
                    <Badge key={lvl} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-white text-slate-500 border-slate-200">
                      {lvl}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCert(cert.name)}
                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {filteredCerts.length === 0 && (
            <div className="col-span-1 sm:col-span-2 text-center py-8 text-slate-400 text-xs font-medium border border-dashed rounded-xl">
              검색된 자격증이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  {/* 공통 3: 상벌점 기준 콘텐츠 */}
  const renderMeritDemeritSettingsContent = () => {
    const currentList = meritRules.filter(r => r.type === activeMeritTab);

    return (
      <div className="space-y-4">
        {/* 상점 / 벌점 탭 전환 */}
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setActiveMeritTab('merit'); setNewRuleType('merit'); }}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeMeritTab === 'merit' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              상점 기준 ({meritRules.filter(r => r.type === 'merit').length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveMeritTab('demerit'); setNewRuleType('demerit'); }}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeMeritTab === 'demerit' ? "bg-white text-rose-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              벌점 기준 ({meritRules.filter(r => r.type === 'demerit').length})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={resetMeritRulesToDefault}
            className="text-[11px] h-8 text-slate-500 hover:text-slate-900 rounded-lg"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> 기본값 복원
          </Button>
        </div>

        {/* 새 항목 등록 폼 */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
          <span className="text-xs font-bold text-slate-700">새 {activeMeritTab === 'merit' ? '상점' : '벌점'} 항목 추가</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input
              placeholder="분류 (예: 기본생활)"
              value={newRuleCategory}
              onChange={(e) => setNewRuleCategory(e.target.value)}
              className="h-9 text-xs bg-white rounded-lg"
            />
            <Input
              placeholder="항목명 (예: 봉사활동 실천)"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              className="h-9 text-xs bg-white rounded-lg sm:col-span-2"
            />
            <div className="flex gap-1.5">
              <Input
                type="number"
                min="1"
                max="1000"
                value={newRulePoints}
                onChange={(e) => setNewRulePoints(parseInt(e.target.value) || 1)}
                className="h-9 text-xs bg-white rounded-lg w-20 shrink-0 font-bold"
              />
              <Button
                type="button"
                onClick={addMeritRule}
                className={cn(
                  "h-9 px-3 text-xs font-bold rounded-lg text-white shrink-0 flex-1",
                  activeMeritTab === 'merit' ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> 추가
              </Button>
            </div>
          </div>
        </div>

        {/* 등록된 항목 목록 테이블 */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">분류</th>
                <th className="py-2.5 px-3">항목명</th>
                <th className="py-2.5 px-3 text-center">점수</th>
                <th className="py-2.5 px-3 text-right">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentList.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-500 font-medium">{rule.category}</td>
                  <td className="py-2 px-3 text-slate-800 font-bold">{rule.name}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-extrabold text-[11px]",
                      rule.type === 'merit' ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {rule.type === 'merit' ? `+${rule.points}점` : `-${rule.points}점`}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMeritRule(rule.id)}
                      className="h-6 w-6 text-slate-400 hover:text-rose-600 rounded-md"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {currentList.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                    등록된 {activeMeritTab === 'merit' ? '상점' : '벌점'} 항목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  {/* 공통 4: 옥저인증제 설정 콘텐츠 */}
  const renderCertifySettingsContent = () => (
    <div className="space-y-4">
      {/* 탭 네비게이션 */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveCertTab('grades')}
          className={cn(
            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
            activeCertTab === 'grades' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
          )}
        >
          교과 성취도 배점
        </button>
        <button
          type="button"
          onClick={() => setActiveCertTab('attendance')}
          className={cn(
            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
            activeCertTab === 'attendance' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
          )}
        >
          출결 감점 기준
        </button>
        <button
          type="button"
          onClick={() => setActiveCertTab('certificates')}
          className={cn(
            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
            activeCertTab === 'certificates' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
          )}
        >
          자격증 배점 한도
        </button>
      </div>

      {activeCertTab === 'grades' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            교과 성취도(A~E)별 인증 환산 점수를 설정합니다. 과목별로 이 점수가 부여되어 합산됩니다.
          </p>
          <div className="grid grid-cols-5 gap-2">
            {['A', 'B', 'C', 'D', 'E'].map((grade) => (
              <div key={grade} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="font-extrabold text-sm text-slate-800">{grade}등급</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={achievementWeights[grade] ?? 0}
                  onChange={(e) => setAchievementWeights({
                    ...achievementWeights,
                    [grade]: parseFloat(e.target.value) || 0
                  })}
                  className="h-8 text-center text-xs font-bold bg-white rounded-lg w-full"
                />
                <span className="text-[10px] text-slate-400 font-semibold">점</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCertTab === 'attendance' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            출결 기본점수(100점)에서 미인정 결석 및 지각 횟수에 따른 감점 기준을 설정합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-xs font-bold text-slate-700">미인정 결석 (1일당)</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={certConfig.attendanceRules?.unexcusedAbsentDeduct ?? 5}
                  onChange={(e) => setCertConfig({
                    ...certConfig,
                    attendanceRules: {
                      ...certConfig.attendanceRules,
                      unexcusedAbsentDeduct: parseFloat(e.target.value) || 0
                    }
                  })}
                  className="h-8 text-xs font-bold bg-white rounded-lg w-24"
                />
                <span className="text-xs text-slate-500">점 감점</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-xs font-bold text-slate-700">미인정 지각/조퇴/결과 (1회당)</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={certConfig.attendanceRules?.unexcusedLateDeduct ?? 2}
                  onChange={(e) => setCertConfig({
                    ...certConfig,
                    attendanceRules: {
                      ...certConfig.attendanceRules,
                      unexcusedLateDeduct: parseFloat(e.target.value) || 0
                    }
                  })}
                  className="h-8 text-xs font-bold bg-white rounded-lg w-24"
                />
                <span className="text-xs text-slate-500">점 감점</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeCertTab === 'certificates' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            국가기술 및 공인 자격증 1개당 부여되는 인증 점수와 최대 인정 한도점수를 설정합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-xs font-bold text-slate-700">자격증 1개당 기본점수</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={certConfig.certificateRules?.basePointsPerCert ?? 10}
                  onChange={(e) => setCertConfig({
                    ...certConfig,
                    certificateRules: {
                      ...certConfig.certificateRules,
                      basePointsPerCert: parseFloat(e.target.value) || 0
                    }
                  })}
                  className="h-8 text-xs font-bold bg-white rounded-lg w-24"
                />
                <span className="text-xs text-slate-500">점</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-xs font-bold text-slate-700">자격증 영역 최대 인정 한도</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={certConfig.certificateRules?.maxCertificatePoints ?? 50}
                  onChange={(e) => setCertConfig({
                    ...certConfig,
                    certificateRules: {
                      ...certConfig.certificateRules,
                      maxCertificatePoints: parseFloat(e.target.value) || 0
                    }
                  })}
                  className="h-8 text-xs font-bold bg-white rounded-lg w-24"
                />
                <span className="text-xs text-slate-500">점</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 헤더 및 전체 저장 버튼 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Settings2 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            시스템 설정
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            학사학년도, 상벌점 기준, 자격증, 인증제 설정을 통합 관리합니다.
          </p>
        </div>
        <Button 
          onClick={handleSaveAll} 
          disabled={isPending} 
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-10 sm:h-11 px-6 sm:px-8 w-full sm:w-auto font-bold text-xs sm:text-sm cursor-pointer"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Save className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
          전체 설정 저장하기
        </Button>
      </div>

      {/* 데스크톱 전용 그리드 레이아웃 (lg 이상) */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-2">
        {/* 1. 학사학년도 및 마감·안전 백업 관리 (전폭 2열 확장) */}
        <Card className="lg:col-span-2 border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-lg font-bold flex items-center justify-between text-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span>학사학년도 및 마감·안전 백업 관리</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                현재 기준 {baseYear}학년도
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex-1">
            {renderYearSettingsContent()}
          </CardContent>
        </Card>

        {/* 2. 학생 상벌점 기준 설정 */}
        <Card className="border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Scale className="h-5 w-5 text-indigo-600" />
              학생 상벌점 기준 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex-1">
            {renderMeritDemeritSettingsContent()}
          </CardContent>
        </Card>

        {/* 3. 옥저인증제 관리 */}
        <Card className="border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Trophy className="h-5 w-5 text-blue-600" />
              옥저인증제 관리
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex-1">
            {renderCertifySettingsContent()}
          </CardContent>
        </Card>

        {/* 4. 자격증 마스터 목록 (전폭 2열 확장) */}
        <Card className="lg:col-span-2 border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Award className="h-5 w-5 text-blue-600" />
              자격증 및 급수 마스터 관리
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {renderCertSettingsContent()}
          </CardContent>
        </Card>
      </div>

      {/* 모바일 전용 아코디언 모드 레이아웃 (lg 미만) */}
      <div className="lg:hidden flex flex-col space-y-3">
        <Accordion type="multiple" defaultValue={['year-settings']} className="space-y-3">
          {/* 1. 학사학년도 아코디언 */}
          <AccordionItem value="year-settings" className="border border-slate-200/80 bg-white rounded-2xl shadow-sm overflow-hidden px-0">
            <AccordionTrigger className="px-4 py-3.5 hover:no-underline bg-slate-50/80 font-bold text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                <span>학사학년도 및 마감·백업 센터</span>
                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">
                  {baseYear}학년도
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-4 border-t border-slate-100">
              {renderYearSettingsContent()}
            </AccordionContent>
          </AccordionItem>

          {/* 2. 상벌점 기준 아코디언 */}
          <AccordionItem value="merit-settings" className="border border-slate-200/80 bg-white rounded-2xl shadow-sm overflow-hidden px-0">
            <AccordionTrigger className="px-4 py-3.5 hover:no-underline bg-slate-50/80 font-bold text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <Scale className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                <span>학생 상벌점 기준 설정</span>
                <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">
                  {meritRules.length}개
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-4 border-t border-slate-100">
              {renderMeritDemeritSettingsContent()}
            </AccordionContent>
          </AccordionItem>

          {/* 3. 옥저인증제 아코디언 */}
          <AccordionItem value="certify-settings" className="border border-slate-200/80 bg-white rounded-2xl shadow-sm overflow-hidden px-0">
            <AccordionTrigger className="px-4 py-3.5 hover:no-underline bg-slate-50/80 font-bold text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                <span>옥저인증제 관리</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-4 border-t border-slate-100">
              {renderCertifySettingsContent()}
            </AccordionContent>
          </AccordionItem>

          {/* 4. 자격증 마스터 아코디언 */}
          <AccordionItem value="cert-settings" className="border border-slate-200/80 bg-white rounded-2xl shadow-sm overflow-hidden px-0">
            <AccordionTrigger className="px-4 py-3.5 hover:no-underline bg-slate-50/80 font-bold text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                <span>자격증 및 급수 마스터 관리</span>
                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">
                  {certs.length}개
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-4 border-t border-slate-100">
              {renderCertSettingsContent()}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* 스냅샷 복원 확인 모달 */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              학사 스냅샷 복원 확인
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 leading-relaxed">
              선택하신 스냅샷 시점으로 <strong>전교생의 인적사항, 성적, 출결, 취업이력</strong>을 원상 복원합니다.
              <br /><br />
              <span className="text-rose-600 font-bold">⚠️ 주의:</span> 현재 학년도의 최신 수정 사항이 과거 백업 데이터로 대체될 수 있습니다. 계속 진행하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRestoreDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleRestoreSnapshot}
              disabled={isRestoring}
              className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isRestoring ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              복원 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 스냅샷 영구 삭제 확인 모달 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              스냅샷 영구 삭제 확인
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 leading-relaxed">
              선택하신 마감 백업 스냅샷을 영구 삭제합니다.
              <br />
              <strong>삭제된 스냅샷 데이터는 다시 복구할 수 없습니다.</strong> 정말로 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleDeleteSnapshot}
              disabled={isDeleting}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
