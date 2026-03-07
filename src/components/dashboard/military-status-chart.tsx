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

const MILITARY_COLORS: Record<string, string> = {
  '부사관': '#2563eb',   // Blue
  '군입대': '#475569',   // Slate
  '병역특례': '#7c3aed', // Purple
  '병역면제': '#ea580c', // Orange
  '미결정': '#cbd5e1',   // Light Gray
};

const MILITARY_OPTIONS = ['부사관', '군입대', '병역특례', '병역면제'];

export default function MilitaryStatusChart({ 
  data,
  selectedMajor = 'all'
}: { 
  data: StudentEmploymentData[],
  selectedMajor?: string
}) {
  const [viewType, setViewType] = React.useState<'pie' | 'bar'>('pie');

  // 1. 도넛 차트용 전체 집계 데이터
  const formattedPieData = React.useMemo(() => {
    const counts = data.reduce((acc, student) => {
      const status = student.military_status || '미결정';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => {
        if (a.name === '미결정') return 1;
        if (b.name === '미결정') return -1;
        const indexA = MILITARY_OPTIONS.indexOf(a.name);
        const indexB = MILITARY_OPTIONS.indexOf(b.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return b.value - a.value;
      });
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
      const groupStudents = data.filter((s: any) => s[groupKey] === group);
      const row: any = { group };
      [...MILITARY_OPTIONS, '미결정'].forEach(opt => {
        row[opt] = groupStudents.filter(s => (s.military_status || '미결정') === opt).length;
      });
      return row;
    });
  }, [data, selectedMajor]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = { value: { label: '학생 수' } };
    [...MILITARY_OPTIONS, '미결정'].forEach((opt) => {
      config[opt] = { label: opt, color: MILITARY_COLORS[opt] || '#cbd5e1' };
    });
    return config;
  }, []);

  return (
    <Card className="flex flex-col border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-bold text-blue-900">병역 희망</CardTitle>
          <CardDescription>{selectedMajor === 'all' ? '전체 학과' : `${selectedMajor}`} 병역 계획 현황입니다.</CardDescription>
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
        {formattedPieData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground"><p className="text-sm font-medium">데이터가 없습니다.</p></div>
        ) : viewType === 'pie' ? (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px] w-full animate-in fade-in zoom-in-95 duration-300">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={formattedPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" paddingAngle={5}
                startAngle={180} endAngle={-180} strokeWidth={1} stroke="#fff" labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formattedPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={MILITARY_COLORS[entry.name] || '#cbd5e1'} />
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
              categoryGap={15}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="group" 
                type="category" 
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
              {[...MILITARY_OPTIONS, '미결정'].map((opt, idx) => (
                <Bar 
                  key={opt} 
                  dataKey={opt} 
                  stackId="a" 
                  fill={MILITARY_COLORS[opt]} 
                  barSize={20} 
                  radius={idx === MILITARY_OPTIONS.length ? [0, 4, 4, 0] : [0, 0, 0, 0]} 
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
