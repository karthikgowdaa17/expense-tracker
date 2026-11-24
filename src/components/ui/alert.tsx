import * as React from 'react';
import { cn } from '@/utils/currency';
import { cva, type VariantProps } from 'class-variance-authority';

const alertVariants = cva(
  'relative w-full rounded-l border border-transparent px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-0 [&>svg]:top-[1/4] [&>svg]:-translate-y-[1/4] [&>svg]:text-foreground [&>~pl-7]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'destructive/10 border-destructive/50 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert" {...props} />
  );
}

type AlertTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

function AlertTitle({ className, ...props }: AlertTitleProps) {
  return (
    <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  );
}

type AlertDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <p className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
