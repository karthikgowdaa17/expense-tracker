'use client';

import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/currency';

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

const CollapsibleChevron = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof ChevronDown>) => (
  <ChevronDown
    className={cn(
      'h-4 w-4 transition-transform duration-200',
      'data-[state=open]:rotate-180',
      className
    )}
    {...props}
  />
);

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleChevron };