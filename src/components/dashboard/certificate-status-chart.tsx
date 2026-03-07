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

// 0개는 진한 회색, 1개부터는 선명한 하늘색/파란색 계열의 그라데이션 적용
const CERT_COLORS = [
  '#cbd5e1', // 0개
  '#bae6fd', // 1개
  '#7dd3fc', // 2개
  '#38bdf8', // 3개
  '#0ea5e9', // 4개
  '#0284c7', // 5개
  '#0369a1', // 6개 이상
];

const CERT_LABELS = ['0개', '1개', '2개', '3개', '4개', '5개', '6개 이상'];

export default function CertificateStatusChart({ 
  data, 
  title = "자격증 취득 현황",
  selectedMajor = 'all'
}: { 
  data: StudentEmploymentData[];
  selectedMajor?: string;
  title?: string;
}) {
  const [viewType, setViewType] = React.useState<'pie' | 'bar'>('pie');

  // 1. 학과별 또는 반별 막대 차트용 데이터 집계
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
      const row: any = { group };
      
      CERT_LABELS.forEach((label, idx) => {
        const count = groupStudents.filter(s => {
          const certCount = s.certificates?.length || 0;
          if (idx === 6) return certCount >= 6;
          return certCount === idx;
        }).length;
        row[label] = count;
      });
      
      return row;
    });
  }, [data, selectedMajor]);

  // 2. 전체 분포 도넛 차트 데이터
  const formattedPieData = React.useMemo(() => {
    const counts = data.reduce((acc, s) => {
      const certCount = s.certificates?.length || 0;
      const bucket = certCount >= 6 ? '6개 이상' : `${certCount}개`;
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return CERT_LABELS.map(label => ({
      name: label,
      value: counts[label] || 0
    })).filter(d => d.value > 0);
  }, [data]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    CERT_LABELS.forEach((label, idx) => {
      config[label] = { label, color: CERT_COLORS[idx] };
    });
    return config;
  }, []);

  return (
    <Card className="flex flex-col border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-bold text-blue-900">{title}</CardTitle>
          <CardDescription>{selectedMajor === 'all' ? '전체 학과' : `${selectedMajor}`} 자격증 취득 현황입니다.</CardDescription>
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
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground"><p className="text-sm font-medium">데이터가 없습니다.</p></div>
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
                  <Cell key={`cell-${entry.name}`} fill={CERT_COLORS[CERT_LABELS.indexOf(entry.name)]} />
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
              {CERT_LABELS.map((label, idx) => (
                <Bar 
                  key={label} 
                  dataKey={label} 
                  stackId="a" 
                  fill={CERT_COLORS[idx]} 
                  barSize={20} 
                  radius={idx === 6 ? [0, 4, 4, 0] : [0, 0, 0, 0]} 
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
