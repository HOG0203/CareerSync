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
  Trash2
} from 'lucide-react';
import { 
  updateMasterCertificates, 
  updateSystemSettings,
  updateCertificationConfig,
  updateMeritDemeritRules,
  getDefaultMeritDemeritRules,
  MasterCertificate,
  CertificationConfig,
  MeritDemeritRule
} from './actions';
import { updateAchievementScores } from '../grades/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface AdminSettingsClientProps {
  initialBaseYear: number;
  initialCerts: MasterCertificate[];
  initialCertConfig: CertificationConfig;
  initialMeritRules: MeritDemeritRule[];
}

export function AdminSettingsClient({
  initialBaseYear,
  initialCerts,
  initialCertConfig,
  initialMeritRules,
}: AdminSettingsClientProps) {
  const [certs, setCerts] = React.useState<MasterCertificate[]>(initialCerts);
  const [baseYear, setBaseYear] = React.useState<number>(initialBaseYear);
  const [certConfig, setCertConfig] = React.useState<CertificationConfig>(initialCertConfig);
  const [achievementWeights, setAchievementWeights] = React.useState<Record<string, number>>(
    initialCertConfig.gradeWeights || { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 }
  );
  const [meritRules, setMeritRules] = React.useState<MeritDemeritRule[]>(initialMeritRules);

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
        toast({ title: '설정 저장 완료', description: '모든 시스템 설정(상벌점 기준, 성적, 출결, 자격증 포함)이 갱신되었습니다.' });
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

  {/* 공통 1: 학사학년도 콘텐츠 */}
  const renderYearSettingsContent = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-slate-600">시스템 기준 학사학년도</label>
        <Select value={baseYear.toString()} onValueChange={(val) => setBaseYear(parseInt(val))}>
          <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl bg-white font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y.toString()} className="font-semibold">{y}학년도</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
        <p className="text-[11px] text-blue-700 leading-relaxed font-semibold">
          💡 <strong>입력 가이드</strong><br/>
          실제 졸업하는 해보다 <strong>1년 앞선 연도</strong>를 입력하세요. (예: 3학년이 2027년 졸업이면 2026 선택)
        </p>
      </div>
    </div>
  );

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredCerts.map((cert) => (
            <div 
              key={cert.name} 
              className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 hover:border-blue-300 transition-colors shadow-2xs"
            >
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-900 truncate">{cert.name}</p>
                {cert.levels.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cert.levels.map(lvl => (
                      <span key={lvl} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                        {lvl}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-400 italic">단일 자격</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCert(cert.name)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {filteredCerts.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
              일치하는 자격증 항목이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  {/* 공통 3: 옥저인증제 통합 관리 콘텐츠 */}
  const renderCertifySettingsContent = () => (
    <div className="space-y-5">
      {/* 서브 탭 메뉴 */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveCertTab('grades')}
          className={cn(
            "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
            activeCertTab === 'grades' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          성적 반영
        </button>
        <button
          type="button"
          onClick={() => setActiveCertTab('attendance')}
          className={cn(
            "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
            activeCertTab === 'attendance' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          출결 반영
        </button>
        <button
          type="button"
          onClick={() => setActiveCertTab('certificates')}
          className={cn(
            "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
            activeCertTab === 'certificates' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Award className="h-3.5 w-3.5" />
          자격증 반영
        </button>
      </div>

      {/* 탭 1: 성적 배점 */}
      {activeCertTab === 'grades' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="grid grid-cols-5 gap-2">
            {(['A', 'B', 'C', 'D', 'E'] as const).map((grade) => (
              <div key={grade} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-slate-50 border-slate-200/80">
                <span className="text-sm font-black text-slate-800">{grade}</span>
                <div className="flex items-center gap-1">
                  <Input 
                    type="number" 
                    value={achievementWeights[grade] ?? 0} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setAchievementWeights(prev => ({ ...prev, [grade]: val }));
                    }}
                    className="h-8 w-12 text-center font-bold text-xs p-1 border-slate-200 rounded-lg text-indigo-600 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 font-bold">점</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
            <p className="text-[11px] text-blue-800 leading-relaxed font-semibold">
              💡 <strong>성적 인증 점수 계산 방식</strong><br/>
              각 성취도별 이수단위와 설정 점수를 곱하여 가중평균 백분율(100점 만점)로 환산 반영됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 탭 2: 출결 감점 */}
      {activeCertTab === 'attendance' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">기본 출결 점수</label>
              <Input 
                type="number" 
                value={certConfig.attendanceRules.baseScore} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCertConfig(prev => ({
                    ...prev,
                    attendanceRules: { ...prev.attendanceRules, baseScore: val }
                  }));
                }}
                className="h-9 font-bold text-xs sm:text-sm border-slate-200 rounded-lg text-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">무단결석 1일당 감점</label>
              <Input 
                type="number" 
                value={certConfig.attendanceRules.unexcusedAbsentDeduct} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCertConfig(prev => ({
                    ...prev,
                    attendanceRules: { ...prev.attendanceRules, unexcusedAbsentDeduct: val }
                  }));
                }}
                className="h-9 font-bold text-xs sm:text-sm border-slate-200 rounded-lg text-rose-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">무단지각/조퇴/결과 1회당 감점</label>
              <Input 
                type="number" 
                value={certConfig.attendanceRules.unexcusedLateDeduct} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCertConfig(prev => ({
                    ...prev,
                    attendanceRules: { ...prev.attendanceRules, unexcusedLateDeduct: val }
                  }));
                }}
                className="h-9 font-bold text-xs sm:text-sm border-slate-200 rounded-lg text-rose-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">최대 감점 한도</label>
              <Input 
                type="number" 
                value={certConfig.attendanceRules.maxDeductLimit} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCertConfig(prev => ({
                    ...prev,
                    attendanceRules: { ...prev.attendanceRules, maxDeductLimit: val }
                  }));
                }}
                className="h-9 font-bold text-xs sm:text-sm border-slate-200 rounded-lg text-rose-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* 탭 3: 자격증 반영 점수 */}
      {activeCertTab === 'certificates' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">자격증 1건당 취득 점수</label>
              <Input 
                type="number" 
                value={certConfig.certificateRules.basePointsPerCert} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCertConfig(prev => ({
                    ...prev,
                    certificateRules: { ...prev.certificateRules, basePointsPerCert: val }
                  }));
                }}
                className="h-9 font-bold text-xs sm:text-sm border-slate-200 rounded-lg text-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">자격증 점수 최대 한도</label>
              <Input 
                type="number" 
                value={certConfig.certificateRules.maxCertificatePoints} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCertConfig(prev => ({
                    ...prev,
                    certificateRules: { ...prev.certificateRules, maxCertificatePoints: val }
                  }));
                }}
                className="h-9 font-bold text-xs sm:text-sm border-slate-200 rounded-lg text-indigo-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  {/* 공통 4: 상벌점 기준 관리 콘텐츠 */}
  const renderMeritDemeritSettingsContent = () => {
    const meritList = meritRules.filter(r => r.type === 'merit');
    const demeritList = meritRules.filter(r => r.type === 'demerit');
    const currentList = activeMeritTab === 'merit' ? meritList : demeritList;

    return (
      <div className="space-y-4">
        {/* 상단 탭 전환 + 기본값 리셋 */}
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <Button
              type="button"
              size="sm"
              variant={activeMeritTab === 'merit' ? 'default' : 'ghost'}
              onClick={() => {
                setActiveMeritTab('merit');
                setNewRuleType('merit');
                setNewRuleCategory('');
              }}
              className={cn("h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg", activeMeritTab === 'merit' && "bg-emerald-600 hover:bg-emerald-700 text-white")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>상점 기준 ({meritList.length})</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeMeritTab === 'demerit' ? 'default' : 'ghost'}
              onClick={() => {
                setActiveMeritTab('demerit');
                setNewRuleType('demerit');
                setNewRuleCategory('');
              }}
              className={cn("h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg", activeMeritTab === 'demerit' && "bg-rose-600 hover:bg-rose-700 text-white")}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>벌점 기준 ({demeritList.length})</span>
            </Button>
          </div>
        </div>

        {/* 신규 항목 등록 폼 */}
        <div className={cn("p-3 sm:p-4 rounded-xl border space-y-3", activeMeritTab === 'merit' ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100")}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">구분 / 카테고리</label>
              <Input
                placeholder={activeMeritTab === 'merit' ? "예: 봉사/선행, 기본생활" : "예: 출결/지각, 수업태도"}
                value={newRuleCategory}
                onChange={(e) => setNewRuleCategory(e.target.value)}
                className="h-8.5 text-xs bg-white border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-600">항목명</label>
              <Input
                placeholder={activeMeritTab === 'merit' ? "예: 교내외 선행 및 모범 행동" : "예: 무단 지각/외출"}
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="h-8.5 text-xs bg-white border-slate-200 rounded-lg font-medium"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">배점 점수:</span>
              <Input
                type="number"
                min={1}
                max={1000}
                value={newRulePoints}
                onChange={(e) => setNewRulePoints(parseInt(e.target.value) || 1)}
                className="h-8 w-20 text-xs font-bold text-center bg-white border-slate-200 rounded-lg"
              />
              <span className="text-xs font-bold text-slate-500">점</span>
            </div>
            <Button
              type="button"
              onClick={addMeritRule}
              className={cn("h-9.5 text-xs sm:text-sm font-extrabold rounded-xl gap-1.5 px-5 shadow-2xs", activeMeritTab === 'merit' ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100" : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100")}
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{activeMeritTab === 'merit' ? '상점 항목 추가' : '벌점 항목 추가'}</span>
            </Button>
          </div>
        </div>

        {/* 항목 목록 리스트 */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {currentList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-medium">
              등록된 {activeMeritTab === 'merit' ? '상점' : '벌점'} 항목이 없습니다.
            </div>
          ) : (
            currentList.map((rule) => (
              <div 
                key={rule.id}
                className="p-2.5 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 hover:border-slate-300 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0", activeMeritTab === 'merit' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                    {rule.category}
                  </Badge>
                  <span className="text-xs font-bold text-slate-800 truncate">{rule.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-xs font-black px-2 py-0.5 rounded-md", activeMeritTab === 'merit' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
                    {activeMeritTab === 'merit' ? `+${rule.points}점` : `-${rule.points}점`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMeritRule(rule.id)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      {/* 상단 제목 및 전체 저장 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Settings2 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            시스템 설정
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">학사학년도, 상벌점 기준, 자격증, 인증제 설정을 통합 관리합니다.</p>
        </div>
        <Button 
          onClick={handleSaveAll} 
          disabled={isPending} 
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-10 sm:h-11 px-6 sm:px-8 w-full sm:w-auto font-bold text-xs sm:text-sm"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Save className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
          전체 설정 저장하기
        </Button>
      </div>

      {/* 데스크톱 전용 2열 그리드 레이아웃 (lg 이상) */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-2">
        {/* 1. 학사학년도 설정 */}
        <Card className="border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Calendar className="h-5 w-5 text-blue-600" />
              학사학년도 설정
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
          <CardContent className="pt-6">
            {renderCertifySettingsContent()}
          </CardContent>
        </Card>

        {/* 4. 자격증 및 급수 마스터 관리 */}
        <Card className="border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col">
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

      {/* 모바일 전용 아코디언 모드 레이아웃 (lg 미만) - 기본 닫힘 적용 */}
      <div className="lg:hidden flex flex-col space-y-3">
        <Accordion type="multiple" defaultValue={[]} className="space-y-3">
          {/* 1. 학사학년도 아코디언 */}
          <AccordionItem value="year-settings" className="border border-slate-200/80 bg-white rounded-2xl shadow-sm overflow-hidden px-0">
            <AccordionTrigger className="px-4 py-3.5 hover:no-underline bg-slate-50/80 font-bold text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                <span>학사학년도 설정</span>
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
    </div>
  );
}