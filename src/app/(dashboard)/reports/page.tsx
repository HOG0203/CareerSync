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
    <Card>
      <CardHeader>
        <CardTitle>보고서</CardTitle>
        <CardDescription>
          사용자 정의 보고서를 생성하고 다운로드하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">
            보고서 기능이 곧 제공될 예정입니다
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            사용자 정의 가능하고 통찰력 있는 보고서를 제공하기 위해 노력하고 있습니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
