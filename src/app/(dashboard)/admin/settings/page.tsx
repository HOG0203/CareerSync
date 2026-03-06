'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Plus, X, Save, Settings2, Calendar, Award, Layers, Loader2 } from 'lucide-react';
import { 
  getMasterCertificates, 
  updateMasterCertificates, 
  getSystemSettings, 
  updateSystemSettings,
  MasterCertificate
} from './actions';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage() {
  const [certs, setCerts] = React.useState<MasterCertificate[]>([]);
  const [newCertName, setNewCertName] = React.useState('');
  const [newCertLevels, setNewCertLevels] = React.useState('');
  const [baseYear, setBaseYear] = React.useState<number>(new Date().getFullYear());
  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    getMasterCertificates().then(setCerts);
    getSystemSettings().then(settings => setBaseYear(settings.baseYear));
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
      const [certResult, settingsResult] = await Promise.all([
        updateMasterCertificates(certs),
        updateSystemSettings({ baseYear })
      ]);

      if (certResult.success && settingsResult.success) {
        toast({ title: '설정 저장 완료', description: '자격증 및 시스템 설정이 갱신되었습니다.' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: certResult.error || settingsResult.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: '저장 중 오류 발생' });
    } finally {
      setIsPending(false);
    }
  };

  // 현재 연도 기준 앞뒤 5년씩
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Settings2 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            시스템 설정
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">자격증 목록 및 급수 체계, 학사학년도를 통합 관리합니다.</p>
        </div>
        <Button 
          onClick={handleSaveAll} 
          disabled={isPending} 
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-11 px-8 w-full sm:w-auto font-bold"
        >
          {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          설정 저장하기
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* 학사학년도 설정 */}
        <Card className="border-none shadow-md bg-white overflow-hidden lg:col-span-1 rounded-2xl">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800">
              <Calendar className="h-5 w-5 text-blue-500" />
              학사학년도 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-600">시스템 기준 학사학년도</label>
                <Select value={baseYear.toString()} onValueChange={(val) => setBaseYear(parseInt(val))}>
                  <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y.toString()}>{y}학년도</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
                <p className="text-[11px] text-blue-700 leading-relaxed font-semibold">
                  💡 **입력 가이드**<br/>
                  실제 졸업하는 해보다 **1년 앞선 연도**를 입력하세요.<br/>
                  예: 현재 3학년이 2027년 초에 졸업한다면, 기준 학년도는 **2026**입니다.
                </p>
                <div className="text-[10px] text-slate-500 italic border-t pt-2.5 border-blue-100 space-y-1">
                  <p className="font-bold text-slate-600">현재 설정: {baseYear}학년도 기준</p>
                  <p>• 3학년: {baseYear + 1}년 졸업 예정자</p>
                  <p>• 2학년: {baseYear + 2}년 졸업 예정자</p>
                  <p>• 1학년: {baseYear + 3}년 졸업 예정자</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 자격증 관리 */}
        <Card className="border-none shadow-md bg-white overflow-hidden lg:col-span-2 rounded-2xl">
          <CardHeader className="bg-slate-50/80 border-b py-4">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800">
              <Award className="h-5 w-5 text-blue-500" />
              자격증 및 급수 마스터 관리
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 px-4 sm:px-6">
            <div className="flex flex-col gap-4 p-4 rounded-2xl bg-blue-50/30 border border-blue-100/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-blue-700">자격증 명칭</label>
                  <Input 
                    placeholder="예: 컴퓨터활용능력" 
                    value={newCertName}
                    onChange={(e) => setNewCertName(e.target.value)}
                    className="h-11 bg-white border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-blue-700">급수 목록 (쉼표 구분)</label>
                  <Input 
                    placeholder="예: 1급, 2급, 3급" 
                    value={newCertLevels}
                    onChange={(e) => setNewCertLevels(e.target.value)}
                    className="h-11 bg-white border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <Button onClick={addCert} className="h-11 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-md shadow-blue-100">
                <Plus className="h-5 w-5 mr-1.5" /> 자격증 추가하기
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[500px] overflow-auto pr-1 custom-scrollbar">
              {certs.map((cert) => (
                <div key={cert.name} className="group flex flex-col p-2.5 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all relative">
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-bold text-slate-800 text-[12px] leading-tight break-all mr-4">{cert.name}</span>
                    <button 
                      onClick={() => removeCert(cert.name)} 
                      className="absolute top-1.5 right-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
