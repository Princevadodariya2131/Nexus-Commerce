import { Suspense } from 'react';
import { ShopContent } from '@/components/shop/ShopContent';

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-28 px-4 md:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card aspect-[3/4] animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
