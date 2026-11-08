import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Browse curated Nexus Commerce collections — electronics, fashion, home & living, accessories, and more.',
};

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
