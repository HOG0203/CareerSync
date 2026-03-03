'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StudentEmploymentData } from '@/lib/data';

interface MajorEmploymentStatusChartProps {
  data: StudentEmploymentData[];
}

export default function MajorEmploymentStatusChart({ data }: MajorEmploymentStatusChartProps) {
  // 학과명 매핑 (약칭 사용)
  const MAJOR_MAP: Record<string, string> = {
    '자동화기계과': '기계',
    '자동차기계과': '자동차',
    '전기과': '전기',
    '스마트공간건축과': '건축',
    '섬유소재과': '섬유',
    '바이오화학과': '화학',
  };

  // 학과별 취업/현장실습 상태 가공
  const processedData = data.reduce((acc: any[], curr) => {
    const rawMajor = curr.major || '기타';
    const major = MAJOR_MAP[rawMajor] || rawMajor;
    
    let existing = acc.find((item) => item.major === major);
    if (!existing) {
      existing = { major, 취업: 0, 현장실습: 0, 미취업: 0 };
      acc.push(existing);
    }

    if (curr.employment_status !== '미취업' && curr.employment_status) {
      existing.취업 += 1;
    } else if (curr.has_field_training === 'O') {
      existing.현장실습 += 1;
    } else {
      existing.미취업 += 1;
    }

    return acc;
  }, []).sort((a, b) => b.취업 - a.취업);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>학과별 취업 및 현장실습 현황</CardTitle>
        <CardDescription>학과별 고용 상태 및 실습 참여 인원 비교</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-2 px-2">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={processedData}
              margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="major" 
                type="category" 
                tick={{ fontSize: 11, fontWeight: 600, fill: '#4b5563' }}
                width={100}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="취업" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} barSize={20} />
              <Bar dataKey="현장실습" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
              <Bar dataKey="미취업" stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
