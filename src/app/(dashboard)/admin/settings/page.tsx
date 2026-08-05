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
  Search 
} from 'lucide-react';
import { 
  getMasterCertificates, 
  updateMasterCertificates, 
  getSystemSettings, 
  updateSystemSettings,
  MasterCertificate
} from './actions';
import { 
  getAchievementScores, 
  updateAchievementScores 
} from '../grades/actions';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage() {
  const [certs, setCerts] = React.useState<MasterCertificate[]>([]);
  const [achievementWeights, setAchievementWeights] = React.useState<Record<string, number>>({
    "A": 5, "B": 4, "C": 3, "D": 2, "E": 1
  });
  const [newCertName, setNewCertName] = React.useState('');
  const [newCertLevels, setNewCertLevels] = React.useState('');
  const [certSearch, setCertSearch] = React.useState('');
  const [baseYear, setBaseYear] = React.useState<number>(new Date().getFullYear());
  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    getMasterCertificates().then(setCerts);
    getSystemSettings().then(settings => setBaseYear(settings.baseYear));
    getAchievementScores().then(setAchievementWeights);
  }, []);

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

  const handleSaveAll = async () => {
    setIsPending(true);
    try {
      const [certResult, settingsResult, weightResult] = await Promise.all([
        updateMasterCertificates(certs),
        updateSystemSettings({ baseYear }),
        updateAchievementScores(achievementWeights)
      ]);

      if (certResult.success && settingsResult.success && weightResult.success) {
        toast({ title: '설정 저장 완료', description: '모든 시스템 설정이 갱신되었습니다.' });
      } else {
        toast({ 
          variant: 'destructive', 
          title: '저장 실패', 
          description: certResult.error || settingsResult.error || (weightResult as any).error 
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
          <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}학년도</SelectItem>)}
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
          <span className="text-xs font-bold text-slate-500">등록된 자격증 ({certs.length}개)</span>
          <div className="relative w-40 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="자격증 검색..." 
              value={certSearch}
              onChange={(e) => setCertSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50/50 border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] lg:max-h-[500px] overflow-auto pr-1 custom-scrollbar">
          {filteredCerts.map((cert) => (
            <div key={cert.name} className="group flex flex-col p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all relative">
              <div className="flex items-start justify-between mb-1.5">
                <span className="font-bold text-slate-800 text-[12px] leading-tight break-all mr-4">{cert.name}</span>
                <button 
                  onClick={() => removeCert(cert.name)} 
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {cert.levels.length > 0 ? cert.levels.map(l => (
                  <Badge key={l} variant="outline" className="text-[9px] py-0 px-1.5 font-medium border-slate-200 text-slate-500 bg-slate-50 rounded-md">
                    {l}
                  </Badge>
                )) : (
                  <span className="text-[9px] text-slate-400 italic">단일 자격</span>
                )}
              </div>
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

  {/* 공통 3: 옥저인증제 콘텐츠 */}
  const renderCertifySettingsContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <label className="text-xs sm:text-sm font-bold text-slate-600">성취도별 인증 점수 가중치</label>
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {['A', 'B', 'C', 'D', 'E'].map(grade => (
            <div key={grade} className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase text-center block">{grade}</label>
              <Input 
                type="number" 
                value={achievementWeights[grade] || 0} 
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setAchievementWeights(prev => ({ ...prev, [grade]: val }));
                }}
                className="h-9 px-1 text-center font-bold text-xs sm:text-sm border-slate-200 focus:border-indigo-500 rounded-lg"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 italic">※ 위 설정은 상단 [전체 설정 저장하기] 클릭 시 반영됩니다.</p>
      </div>

      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
        <p className="text-[11px] text-indigo-700 leading-relaxed font-semibold">
          💡 <strong>인증 점수 계산 방식</strong><br/>
          성취도(A~E) 점수와 과목별 학점을 가중치로 하여 100점 만점으로 환산합니다.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      {/* 상단 제목 및 전체 저장 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Settings2 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            시스템 설정
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">학사학년도, 자격증, 인증제 설정을 통합 관리합니다.</p>
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

        <Card className="border-none shadow-md bg-white overflow-hidden rounded-2xl flex flex-col lg:row-span-2">
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
      </div>

      {/* 모바일 전용 아코디언 모드 레이아웃 (lg 미만) - 색상 통일 적용 */}
      <div className="lg:hidden flex flex-col space-y-3">
        <Accordion type="multiple" defaultValue={["year-settings", "cert-settings", "certify-settings"]} className="space-y-3">
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

          {/* 2. 자격증 마스터 아코디언 */}
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
        </Accordion>
      </div>

    </div>
  );
}

