'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  List,
  PlusCircle,
  Calendar,
  Target,
  Wallet,
  BarChart2,
  Repeat,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: List },
  { name: 'Add Transaction', href: '/add-transaction', icon: PlusCircle },
  { name: 'Monthly', href: '/monthly', icon: Calendar },
  { name: 'Budgets', href: '/budgets', icon: Target },
  { name: 'Income', href: '/income', icon: Wallet },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Recurring', href: '/recurring', icon: Repeat },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="icon"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-background lg:static lg:z-auto transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4 lg:justify-center">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">₹</span>
            </div>
            <span className="font-semibold text-xl">ExpenseTracker</span>
          </Link>
          <Button
            className="lg:hidden"
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4 lg:hidden">
          <p className="text-xs text-muted-foreground text-center">
            ExpenseTracker v1.0
          </p>
        </div>
      </aside>
    </>
  );
}