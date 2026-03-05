'use server';

import {
  analyzeEmploymentTrends,
  type TrendAnalysisOutput,
} from '@/ai/flows/ai-powered-trend-analysis';
import { getAllStudentBaseData } from '@/lib/data';

export async function getAiTrendAnalysis(): Promise<
  TrendAnalysisOutput | { error: string }
> {
  try {
    const studentEmploymentData = await getAllStudentBaseData();
    const analysis = await analyzeEmploymentTrends({
      employmentDataJson: JSON.stringify(studentEmploymentData),
    });
    return analysis;
  } catch (error) {
    console.error('AI trend analysis failed:', error);
    // It's better to return a generic error message to the client.
    return {
      error: 'AI 분석 생성에 실패했습니다. 예상치 못한 오류가 발생했습니다.',
    };
  }
}
