'use client';

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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { StudentEmploymentData } from '@/lib/types';

export default function EmploymentByIndustryChart({ data }: { data: StudentEmploymentData[] }) {
  const chartData = Object.entries(
    data
      .filter((s) => s.business_type === '예')
      .reduce((acc, s) => {
        // 현재 스키마에 industry 필드가 명확하지 않으므로, 추후 확장을 대비해 안전하게 처리
        const industry = (s as any).industry || '기타';
        acc[industry] = (acc[industry] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const chartConfig = {
    value: { label: '학생 수', color: '#2563eb' },
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold">산업군별 취업 분포</CardTitle>
        <CardDescription>다양한 산업에 걸친 취업 졸업생 분포.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
