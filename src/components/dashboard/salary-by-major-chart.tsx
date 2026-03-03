'use client';

import * as React from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
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

const chartConfig = {
  averageSalary: {
    label: '평균 급여',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export default function SalaryByMajorChart({ 
  data, 
  majors 
}: { 
  data: StudentEmploymentData[]; 
  majors: string[] 
}) {
  const salaryDataByMajor = React.useMemo(() => {
    return majors.map(major => {
      const majorStudents = data.filter(s => s.major === major && s.employmentStatus === '취업' && s.salary > 0);
      const averageSalary = majorStudents.length > 0 ? majorStudents.reduce((acc, s) => acc + s.salary, 0) / majorStudents.length : 0;
      return {
          major,
          averageSalary: Math.round(averageSalary),
      };
    });
  }, [data, majors]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>전공별 평균 급여</CardTitle>
        <CardDescription>
          다른 전공 졸업생들의 평균 급여 비교.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={salaryDataByMajor} margin={{ top: 20, right: 20, left: 20, bottom: 5, }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="major"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tickFormatter={(value) =>
                `$${(value as number / 1000).toFixed(0)}k`
              }
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `$${(value as number).toLocaleString()}`} />}
            />
            <Bar dataKey="averageSalary" fill="var(--color-averageSalary)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}