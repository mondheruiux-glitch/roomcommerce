'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface StudioNavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function StudioNavLink({ href, children }: StudioNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/studio' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-brand-terracotta-subtle text-brand-terracotta-hover font-semibold'
          : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-subtle'
      }`}
    >
      {children}
    </Link>
  );
}
