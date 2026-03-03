'use client';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { StudentEmploymentData } from '@/lib/data';
import * as React from 'react';

const chartConfig = {
  employed: {
    label: '취업 학생',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export default function EmploymentOverTimeChart({
  data,
  graduationYears
}: {
  data: StudentEmploymentData[];
  graduationYears: number[];
}) {
  const employmentOverTime = React.useMemo(() => {
    return [...graduationYears].sort().map(year => {
      const employedCount = data.filter(s => s.graduationYear === year && s.employmentStatus === '취업').length;
      return { year: year.toString(), employed: employedCount };
    });
  }, [data, graduationYears]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>시간에 따른 취업 트렌드</CardTitle>
        <CardDescription>
          졸업 연도별 취업 학생 수.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={employmentOverTime}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillEmployed" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-employed)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-employed)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="employed"
              type="natural"
              fill="url(#fillEmployed)"
              fillOpacity={0.4}
              stroke="var(--color-employed)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}