import { Briefcase } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Briefcase className="h-6 w-6 text-primary" />
      <h1 className="text-xl font-bold text-foreground">커리어싱크</h1>
    </div>
  );
}
