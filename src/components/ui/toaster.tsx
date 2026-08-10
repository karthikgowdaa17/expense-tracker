import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';
import { cn } from '@/utils/currency';

const Toaster = ({ ...props }: Partial<ToasterProps>) => {
  return (
    <SonnerToaster
      theme="system"
      className={cn('toaster group', props.className)}
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };