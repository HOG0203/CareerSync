import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            보고서
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            사용자 정의 보고서를 생성하고 다운로드하세요.
          </p>
        </div>
      </div>

      <Card className="flex-1 shadow-sm border bg-white rounded-xl overflow-hidden">
        <CardContent className="h-full p-6 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center w-full h-full rounded-md border border-dashed p-8 text-center bg-slate-50/50">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
              <FileText className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="mt-6 text-xl font-bold text-gray-900">
              보고서 기능이 곧 제공될 예정입니다
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground font-medium">
              사용자 정의 가능하고 통찰력 있는 보고서를 제공하기 위해 노력하고 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
