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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { StudentEmploymentData } from '@/lib/data';
import { Pie, PieChart, Cell } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';

export default function EmploymentByIndustryChart({ data }: { data: StudentEmploymentData[] }) {
  const chartDataAndConfig = React.useMemo(() => {
    const industryData = data
      .filter((s) => s.employmentStatus === '취업')
      .reduce((acc, s) => {
        acc[s.industry] = (acc[s.industry] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const chartData = Object.entries(industryData).map(([industry, count]) => ({
      name: industry,
      value: count,
    }));

    const config = {
      value: {
        label: '학생 수',
      },
      ...Object.fromEntries(
        chartData.map((d, i) => [
          d.name,
          {
            label: d.name,
            color: `hsl(var(--chart-${(i % 5) + 1}))`,
          },
        ])
      ),
    } satisfies ChartConfig;
    
    return { chartData, config };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>산업별 취업 현황</CardTitle>
        <CardDescription>
          다양한 산업에 걸친 취업 졸업생 분포.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartDataAndConfig.config}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie data={chartDataAndConfig.chartData} dataKey="value" nameKey="name" innerRadius={60}>
              {chartDataAndConfig.chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={(chartDataAndConfig.config as Record<string, { color?: string }>)[entry.name]?.color}
                />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}