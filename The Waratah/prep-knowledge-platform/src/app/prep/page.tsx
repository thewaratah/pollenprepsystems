'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function PrepDashboard() {
  const cards = [
    {
      title: 'Weekly Stocktake',
      href: '/prep/stocktake',
      icon: '📋',
      description: 'Enter counts & generate prep',
      color: '#4A5D23', // waratah-mid (primary brand green)
      highlight: true,
    },
    {
      title: 'Ordering',
      href: '/prep/ordering',
      icon: '📦',
      description: 'Supplier orders by staff',
      color: '#4A5D23', // waratah-mid
    },
    {
      title: 'Batching',
      href: '/prep/batching',
      icon: '🫙',
      description: 'Prep tasks and batches',
      color: '#6B7F3A', // waratah-sage
    },
    {
      title: 'Ingredients',
      href: '/prep/ingredients',
      icon: '🍸',
      description: 'Ingredient prep list',
      color: '#4A5D23', // waratah-mid
    },
  ];

  return (
    <div className="container-tablet space-y-8 py-6">
      {/* Hero Section - Design Prompt: deep to mid green gradient */}
      <div
        className="relative rounded overflow-hidden p-8 md:p-10 waratah-gradient"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <Image
              src="/images/waratah-logo.svg"
              alt="The Waratah"
              width={80}
              height={80}
              className="brightness-150"
            />
            <div>
              <h1 className="text-3xl font-bold text-waratah-white">
                Prep Dashboard
              </h1>
              <p className="text-waratah-cream font-mono-caps text-xs">
                The Waratah Kitchen Operations
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Quick Links - Design Prompt: elevated dark cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className={`block p-6 rounded border hover:shadow-lg transition-shadow waratah-glow-hover ${
              card.highlight ? 'waratah-active-accent bg-waratah-card' : 'waratah-card'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-3xl mb-2 block">{card.icon}</span>
                <h2 className="text-base text-waratah-cream">
                  {card.title}
                </h2>
                <p className="text-xs text-waratah-olive mt-1">
                  {card.description}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-waratah-olive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>

          </Link>
        ))}
      </div>

      {/* Staff Quick Links - Design Prompt: elevated dark surfaces */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/prep/ordering?staff=andie"
          className="flex items-center justify-between p-4 rounded waratah-card hover:shadow-md transition-shadow waratah-glow-hover"
        >
          <div className="flex items-center gap-3">
            <div
              className="touch-target rounded-full text-waratah-white font-bold text-lg"
              style={{ backgroundColor: '#4A5D23' }}
            >
              A
            </div>
            <div>
              <p className="font-medium text-waratah-cream">Andie's Orders</p>
              <p className="text-sm text-waratah-olive">
                View filtered ordering list
              </p>
            </div>
          </div>
          <svg
            className="w-5 h-5 text-waratah-olive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>

        <Link
          href="/prep/ordering?staff=blade"
          className="flex items-center justify-between p-4 rounded waratah-card hover:shadow-md transition-shadow waratah-glow-hover"
        >
          <div className="flex items-center gap-3">
            <div
              className="touch-target rounded-full text-waratah-white font-bold text-lg"
              style={{ backgroundColor: '#6B7F3A' }}
            >
              B
            </div>
            <div>
              <p className="font-medium text-waratah-cream">Blade's Orders</p>
              <p className="text-sm text-waratah-olive">
                View filtered ordering list
              </p>
            </div>
          </div>
          <svg
            className="w-5 h-5 text-waratah-olive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
