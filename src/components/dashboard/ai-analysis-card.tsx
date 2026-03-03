'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { getAiTrendAnalysis } from '@/lib/actions';
import type { TrendAnalysisOutput } from '@/ai/flows/ai-powered-trend-analysis';
import { Lightbulb, Zap, AlertTriangle, CheckCircle, ListTree } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

type AnalysisState = {
  data: TrendAnalysisOutput | null;
  error: string | null;
};

export default function AiAnalysisCard() {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisState>({
    data: null,
    error: null,
  });
  const { toast } = useToast();

  const handleAnalysis = () => {
    startTransition(async () => {
      const result = await getAiTrendAnalysis();
      if ('error' in result) {
        setAnalysis({ data: null, error: result.error });
        console.error('분석 실패:', result.error);
      } else {
        setAnalysis({ data: result, error: null });
      }
    });
  };

  const renderContent = () => {
    if (isPending) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-6 w-1/2 mt-4" />
           <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      );
    }

    if (analysis.error) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-destructive py-8">
          <AlertTriangle className="h-10 w-10 mb-4" />
          <p className="font-semibold">오류가 발생했습니다</p>
          <p className="text-sm">{analysis.error}</p>
        </div>
      );
    }
    
    if (analysis.data) {
      return (
        <div className="space-y-6 text-sm">
          <div>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              전체 요약
            </h3>
            <p className="text-muted-foreground">{analysis.data.overallSummary}</p>
          </div>
          <div>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              중요한 트렌드
            </h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {analysis.data.significantTrends.map((trend, i) => <li key={i}>{trend}</li>)}
            </ul>
          </div>
           <div>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              고용 시장 전망
            </h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {analysis.data.jobMarketOutlookPredictions.map((prediction, i) => <li key={i}>{prediction}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <ListTree className="h-5 w-5 text-primary" />
              주요 영향 요인
            </h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {analysis.data.keyInfluencingFactors.map((factor, i) => <li key={i}>{factor}</li>)}
            </ul>
          </div>
        </div>
      );
    }

    return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
          <Lightbulb className="h-10 w-10 mb-4" />
          <p>버튼을 클릭하여 고용 데이터에 대한 AI 기반 분석을 생성하세요.</p>
        </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 기반 트렌드 분석</CardTitle>
        <CardDescription>
          중요한 트렌드를 자동으로 식별하고, 고용 시장 전망을 예측하며, 주요 영향 요인을 요약합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[200px]">
        {renderContent()}
      </CardContent>
      <CardFooter>
        <Button onClick={handleAnalysis} disabled={isPending}>
          {isPending ? '분석 중...' : 'AI 분석 생성'}
        </Button>
      </CardFooter>
    </Card>
  );
}
