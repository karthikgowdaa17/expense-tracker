'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, calculatePercentage } from '@/utils/currency';
import { ChartDataPoint } from '@/types';

interface CategoryBreakdownProps {
  data: (ChartDataPoint & { percentage: number; color: string })[];
  title: string;
}

export function CategoryBreakdown({ data, title }: CategoryBreakdownProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 8).map((item, index) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="font-semibold">{formatCurrency(item.value)}</span>
                  <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                </div>
              </div>
              <Progress value={item.percentage} className="h-1.5" />
            </div>
          ))}
          {data.length > 8 && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              +{data.length - 8} more categories
            </div>
          )}
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold">{formatCurrency(total)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}