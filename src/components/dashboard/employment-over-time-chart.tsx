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
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { StudentEmploymentData } from '@/lib/types';

export default function EmploymentOverTimeChart({ data }: { data: StudentEmploymentData[] }) {
  const years = Array.from(new Set(data.map((s) => s.graduation_year).filter(Boolean))).sort() as number[];
  
  const chartData = years.map((year) => {
    const employedCount = data.filter(s => s.graduation_year === year && s.business_type === '예').length;
    const totalCount = data.filter(s => s.graduation_year === year && s.business_type !== '제외인정자').length;
    
    return {
      year: `${year}년`,
      rate: totalCount > 0 ? parseFloat(((employedCount / totalCount) * 100).toFixed(1)) : 0,
    };
  });

  const chartConfig = {
    rate: { label: '취업률 (%)', color: '#2563eb' },
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold">연도별 취업률 추이</CardTitle>
        <CardDescription>지난 몇 년간의 취업 성공률 변화.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="rate" stroke="var(--color-rate)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
