'use server';
/**
 * @fileOverview 학생 취업 데이터 분석을 위한 AI 에이전트. 트렌드를 파악하고, 고용 시장을 전망하며, 영향 요인을 요약합니다.
 *
 * - analyzeEmploymentTrends - 학생 취업 데이터의 AI 기반 분석을 조율하는 함수.
 * - TrendAnalysisInput - analyzeEmploymentTrends 함수를 위한 입력 타입으로, 원시 취업 데이터를 포함합니다.
 * - TrendAnalysisOutput - analyzeEmploymentTrends 함수를 위한 반환 타입으로, 구조화된 인사이트 요약을 제공합니다.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * 단일 학생 취업 기록에 대한 스키마.
 */
const EmploymentRecordSchema = z.object({
  studentId: z.string().describe('학생의 고유 식별자.'),
  graduationYear: z.number().describe('학생이 졸업한 연도.'),
  major: z.string().describe('학생의 전공.'),
  company: z.string().describe('학생이 취업한 회사의 이름.'),
  role: z.string().describe('학생이 맡은 직무 또는 직책.'),
  industry: z.string().describe('취업한 회사의 산업.'),
  startDate: z.string().describe('YYYY-MM-DD 형식의 취업 시작일.'),
  salary: z.number().optional().describe('학생의 연봉 (가능한 경우).'),
});

/**
 * AI 기반 트렌드 분석 흐름의 입력 스키마.
 * 학생 취업 기록의 배열을 나타내는 JSON 문자열을 예상합니다.
 */
const TrendAnalysisInputSchema = z.object({
  employmentDataJson: z
    .string()
    .describe(
      '학생 취업 기록의 배열을 나타내는 JSON 문자열입니다. 각 기록은 EmploymentRecordSchema를 준수해야 하며 graduationYear, major, company, role, industry, startDate, 그리고 선택적으로 salary와 같은 필드를 포함해야 합니다.'
    ),
});
export type TrendAnalysisInput = z.infer<typeof TrendAnalysisInputSchema>;

/**
 * AI 기반 트렌드 분석 흐름의 출력 스키마.
 * 식별된 트렌드, 예측 및 영향 요인에 대한 구조화된 요약을 제공합니다.
 */
const TrendAnalysisOutputSchema = z.object({
  overallSummary: z
    .string()
    .describe('취업 데이터 및 주요 결과에 대한 전반적인 텍스트 요약.'),
  significantTrends: z
    .array(z.string())
    .describe(
      '특정 산업의 성장, 인기 있는 직무의 변화 또는 급여 트렌드와 같이 식별된 중요한 취업 트렌드 목록.'
    ),
  jobMarketOutlookPredictions: z
    .array(z.string())
    .describe(
      '관찰된 데이터를 기반으로 특정 분야 또는 전공의 미래 고용 시장 전망에 대한 예측.'
    ),
  keyInfluencingFactors: z
    .array(z.string())
    .describe(
      '학생 취업 성공 또는 산업 선택에 영향을 미치는 것으로 보이는 주요 요인 목록.'
    ),
});
export type TrendAnalysisOutput = z.infer<typeof TrendAnalysisOutputSchema>;

/**
 * AI 기반 도구를 사용하여 학생 취업 데이터를 분석하여 트렌드를 식별하고,
 * 미래 고용 시장을 전망하며, 주요 영향 요인을 요약합니다.
 *
 * @param input - 학생 취업 기록의 JSON 문자열을 포함하는 객체.
 * @returns 전체 요약, 중요한 트렌드,
 *   고용 시장 전망 예측 및 주요 영향 요인을 포함하는 객체로 해석되는 프로미스.
 */
export async function analyzeEmploymentTrends(
  input: TrendAnalysisInput
): Promise<TrendAnalysisOutput> {
  return analyzeEmploymentTrendsFlow(input);
}

/**
 * AI가 취업 데이터를 분석하도록 프롬프트를 정의합니다.
 * AI에게 전문 분석가 역할을 하도록 지시하고 특정 인사이트를 추출하도록 합니다.
 */
const analyzeEmploymentTrendsPrompt = ai.definePrompt({
  name: 'analyzeEmploymentTrendsPrompt',
  input: {schema: TrendAnalysisInputSchema},
  output: {schema: TrendAnalysisOutputSchema},
  prompt: `당신은 전문 취업 데이터 분석가입니다. 당신의 임무는 제공된 학생 취업 데이터를 분석하여 중요한 트렌드를 식별하고, 미래 고용 시장 전망을 예측하며, 학생 취업에 대한 주요 영향 요인을 요약하는 것입니다.

다음 학생 취업 데이터를 분석하십시오. 데이터는 취업 기록의 JSON 배열로 제공됩니다. 각 기록에는 학생 ID, 졸업 연도, 전공, 회사, 직무, 산업, 시작일 및 선택적으로 급여와 같은 세부 정보가 포함됩니다.

학생 취업 데이터:
{{{employmentDataJson}}}

이 데이터를 바탕으로 다음을 제공하십시오:
1.  취업 환경에 대한 전반적인 요약.
2.  중요한 취업 트렌드 (예: 특정 산업의 성장, 인기 있는 직무의 변화, 급여 트렌드).
3.  관찰된 데이터를 기반으로 한 특정 분야 또는 전공의 미래 고용 시장 전망 예측.
4.  학생 취업 성공 또는 산업 선택에 영향을 미치는 것으로 보이는 주요 요인.

출력이 다음 스키마와 일치하는 JSON 객체인지 확인하십시오:
{{jsonSchema TrendAnalysisOutputSchema}}`,
});

/**
 * 학생 취업 트렌드 분석을 위한 Genkit 흐름을 정의합니다.
 * 취업 데이터를 입력으로 받아 정의된 AI 프롬프트를 사용하여 처리하고,
 * 분석의 구조화된 출력을 반환합니다.
 */
const analyzeEmploymentTrendsFlow = ai.defineFlow(
  {
    name: 'analyzeEmploymentTrendsFlow',
    inputSchema: TrendAnalysisInputSchema,
    outputSchema: TrendAnalysisOutputSchema,
  },
  async input => {
    const {output} = await analyzeEmploymentTrendsPrompt(input);
    // LLM은 outputSchema에 따라 구조화된 JSON 출력을 반환할 것으로 예상됩니다.
    // Genkit의 프롬프트 반환 유형에 따라 출력이 null이 아님을 단언합니다.
    return output!;
  }
);
