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
import { Cell, Pie, PieChart, Legend, Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { StudentEmploymentData, MAJOR_SORT_ORDER } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, PieChart as PieChartIcon } from 'lucide-react';

const VIVID_COLORS = [
  '#2563eb', // Vivid Blue
  '#7c3aed', // Vivid Purple
  '#ea580c', // Vivid Orange
  '#16a34a', // Vivid Green
  '#dc2626', // Vivid Red
  '#475569', // Vivid Slate
  '#ca8a04', // Vivid Yellow
  '#0d9488', // Teal
];

const COMPANY_TYPES = ['대기업', '공기업', '공무원', '중견기업', '강소기업', '연계교육', '부사관', '기타'];

export default function CompanyTypeChart({ 
  data,
  selectedMajor = 'all'
}: { 
  data: StudentEmploymentData[],
  selectedMajor?: string
}) {
  const [viewType, setViewType] = React.useState<'pie' | 'bar'>('pie');

  // 1. 도넛 차트용 전체 집계 데이터 (취업자 대상)
  const formattedPieData = React.useMemo(() => {
    const counts = data.reduce((acc, student) => {
      if (student.business_type === '취업') {
        const type = student.company_type || '기타';
        acc[type] = (acc[type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // 2. 학과별 또는 반별 막대 차트용 데이터 집계 (MAJOR_SORT_ORDER 준수)
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

    return groups.map(group => {
      const groupStudents = data.filter(s => s[groupKey] === group && s.business_type === '취업');
      const row: any = { group };
      COMPANY_TYPES.forEach(type => {
        row[type] = groupStudents.filter(s => (s.company_type || '기타') === type).length;
      });
      return row;
    });
  }, [data, selectedMajor]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = { value: { label: '학생 수' } };
    COMPANY_TYPES.forEach((type, idx) => {
      config[type] = { label: type, color: VIVID_COLORS[idx % VIVID_COLORS.length] };
    });
    return config;
  }, []);

  const hasData = formattedPieData.length > 0;

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white overflow-hidden flex flex-col h-full hover:border-slate-300 transition-all">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 sm:p-5 flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
          <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-indigo-600 shrink-0" />
            <span>취업 기업 유형 분석</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 font-medium">{selectedMajor === 'all' ? '전체 학과' : `${selectedMajor}`} 취업 확정자의 기업 규모/유형 분석입니다.</CardDescription>
        </div>
        <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="w-auto shrink-0">
          <TabsList className="bg-slate-200/70 p-0.5 rounded-xl h-8 gap-0.5">
            <TabsTrigger value="pie" className="rounded-lg text-xs font-bold px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs">
              <PieChartIcon className="h-3.5 w-3.5 mr-1 text-indigo-600" />분포
            </TabsTrigger>
            <TabsTrigger value="bar" className="rounded-lg text-xs font-bold px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs">
              <LayoutGrid className="h-3.5 w-3.5 mr-1 text-indigo-600" />
              {selectedMajor === 'all' ? '학과별' : '반별'}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 pb-4 relative min-h-[300px]">
        {!hasData ? (
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
                data={formattedPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" paddingAngle={2}
                startAngle={180} endAngle={-180} strokeWidth={1} stroke="#fff" labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formattedPieData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={chartConfig[entry.name]?.color || '#cbd5e1'} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" align="center" iconType="circle" layout="horizontal" wrapperStyle={{ fontSize: '10px', paddingTop: '30px' }} />
            </PieChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <BarChart 
              data={formattedBarData} 
              layout="vertical"
              margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
              barCategoryGap={15}
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
              {COMPANY_TYPES.map((type, idx) => (
                <Bar 
                  key={type} 
                  dataKey={type} 
                  stackId="a" 
                  fill={chartConfig[type]?.color} 
                  barSize={20} 
                  radius={idx === COMPANY_TYPES.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} 
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
