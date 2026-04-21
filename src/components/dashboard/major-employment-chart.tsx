'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Pie, PieChart, Cell } from 'recharts';
import { StudentEmploymentData, MAJOR_SORT_ORDER } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, PieChart as PieChartIcon } from 'lucide-react';

const CHART_COLORS = {
  취업: '#10b981',      // Emerald-500
  미취업: '#ef4444',    // Red-500
  제외인정자: '#94a3b8', // Slate-400
  면접중: '#f59e0b',      // Amber-500
  현장실습중: '#3b82f6',   // Blue-500
  미결정: '#cbd5e1',    // Slate-300 (미설정)
};

export default function MajorEmploymentChart({ 
  data,
  selectedMajor = 'all'
}: { 
  data: StudentEmploymentData[],
  selectedMajor?: string
}) {
  const [viewType, setViewType] = React.useState<'pie' | 'bar'>('pie');

  // 1. 학과별 또는 반별 막대 차트 데이터
  const formattedBarData = React.useMemo(() => {
    const isFiltered = selectedMajor !== 'all';
    const groupKey = isFiltered ? 'class_info' : 'major';

    const groups = Array.from(new Set(data.map((s: any) => s[groupKey]).filter(Boolean))).sort((a: any, b: any) => {
      if (!isFiltered) {
        const indexA = MAJOR_SORT_ORDER.indexOf(a);
        const indexB = MAJOR_SORT_ORDER.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      }
      return a.localeCompare(b, 'ko');
    });
    
    return groups.map((group) => {
      const groupStudents = data.filter((s: any) => s[groupKey] === group);
      const 취업 = groupStudents.filter((s) => s.business_type === '취업').length;
      const 미취업 = groupStudents.filter((s) => s.business_type === '미취업').length;
      const 제외인정자 = groupStudents.filter((s) => s.business_type === '제외인정자').length;
      const 면접중 = groupStudents.filter((s) => s.business_type === '면접중').length;
      const 현장실습중 = groupStudents.filter((s) => s.business_type === '현장실습중').length;
      const 미결정 = groupStudents.filter((s) => !s.business_type).length;
      
      return { group, 취업, 미취업, 제외인정자, 면접중, 현장실습중, 미결정 };
    });
  }, [data, selectedMajor]);

  // 2. 전체 분포 도넛 차트 데이터
  const formattedPieData = React.useMemo(() => {
    const counts = data.reduce((acc, s) => {
      const status = s.business_type || '미결정';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: '취업', value: counts['취업'] || 0 },
      { name: '미취업', value: counts['미취업'] || 0 },
      { name: '제외인정자', value: counts['제외인정자'] || 0 },
      { name: '면접중', value: counts['면접중'] || 0 },
      { name: '현장실습중', value: counts['현장실습중'] || 0 },
      { name: '미결정', value: counts['미결정'] || 0 },
    ].filter(d => d.value > 0);
  }, [data]);

  const chartConfig = {
    취업: { label: '취업', color: CHART_COLORS.취업 },
    미취업: { label: '미취업', color: CHART_COLORS.미취업 },
    면접중: { label: '면접중', color: CHART_COLORS.면접중 },
    현장실습중: { label: '현장실습중', color: CHART_COLORS.현장실습중 },
    제외인정자: { label: '제외인정자', color: CHART_COLORS.제외인정자 },
    미결정: { label: '미결정', color: CHART_COLORS.미결정 },
  } satisfies ChartConfig;

  return (
    <Card className="flex flex-col border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-bold text-blue-900">취업 현황</CardTitle>
          <CardDescription>{selectedMajor === 'all' ? '전체 학과' : `${selectedMajor}`} 취업 및 진로 분석입니다.</CardDescription>
        </div>
        <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="w-auto">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="pie" className="px-2 py-1"><PieChartIcon className="h-3.5 w-3.5 mr-1" />분포</TabsTrigger>
            <TabsTrigger value="bar" className="px-2 py-1">
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              {selectedMajor === 'all' ? '학과별' : '반별'}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 pb-4 relative min-h-[300px]">
        {data.length === 0 || (viewType === 'pie' && formattedPieData.every(d => d.value === 0)) ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground animate-in fade-in duration-500">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
            </div>
            <p className="text-sm font-medium">분석 가능한 데이터가 없습니다.</p>
          </div>
        ) : viewType === 'pie' ? (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px] w-full animate-in fade-in zoom-in-95 duration-300">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={formattedPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" paddingAngle={5}
                startAngle={180} endAngle={-180} strokeWidth={1} stroke="#fff" labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formattedPieData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={CHART_COLORS[entry.name as keyof typeof CHART_COLORS]} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" align="center" iconType="circle" layout="horizontal" wrapperStyle={{ fontSize: '10px', paddingTop: '30px' }} />
            </PieChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full animate-in fade-in slide-in-from-left-4 duration-300">
            <BarChart 
              data={formattedBarData} 
              layout="vertical"
              margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
              categoryGap={15}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="group" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 600 }} 
                width={80}
                tickFormatter={(val) => selectedMajor !== 'all' ? (val.includes('반') ? val : `${val}반`) : val}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    labelFormatter={(label) => selectedMajor !== 'all' ? (label.includes('반') ? label : `${label}반`) : label} 
                  />
                } 
              />
              <Legend verticalAlign="bottom" align="center" iconType="circle" layout="horizontal" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              <Bar dataKey="취업" stackId="a" fill={CHART_COLORS.취업} barSize={20} />
              <Bar dataKey="미취업" stackId="a" fill={CHART_COLORS.미취업} barSize={20} />
              <Bar dataKey="제외인정자" stackId="a" fill={CHART_COLORS.제외인정자} barSize={20} />
              <Bar dataKey="면접중" stackId="a" fill={CHART_COLORS.면접중} barSize={20} />
              <Bar dataKey="현장실습중" stackId="a" fill={CHART_COLORS.현장실습중} barSize={20} />
              <Bar dataKey="미결정" stackId="a" fill={CHART_COLORS.미결정} barSize={20} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
