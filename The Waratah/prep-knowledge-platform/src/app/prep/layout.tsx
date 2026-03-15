'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/prep', label: 'Dashboard', icon: '📊' },
  { href: '/prep/ordering', label: 'Ordering', icon: '📦' },
  { href: '/prep/batching', label: 'Batching', icon: '🍳' },
  { href: '/prep/ingredients', label: 'Ingredients', icon: '🥬' },
];

export default function PrepLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-waratah-black">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b shadow-sm waratah-gradient"
        style={{ borderColor: '#2D3A16' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/prep" className="flex items-center gap-3">
              <Image
                src="/images/waratah-logo.svg"
                alt="The Waratah"
                width={120}
                height={40}
                className="h-8 w-auto brightness-150"
              />
              <span
                className="hidden sm:block text-sm font-medium text-waratah-cream"
              >
                PREP SYSTEM
              </span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-waratah-white/20 text-waratah-white'
                        : 'text-waratah-cream hover:text-waratah-white hover:bg-waratah-white/10'
                    }`}
                  >
                    <span className="mr-1.5">{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t py-4" style={{ borderColor: '#2D3A16' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-waratah-olive">
            Generated from Airtable • The Waratah Prep System
          </p>
        </div>
      </footer>

    </div>
  );
}
