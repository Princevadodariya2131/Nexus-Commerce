import { Suspense } from 'react';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-28 px-4">
          <div className="mx-auto max-w-5xl h-96 glass-card animate-pulse rounded-2xl" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
