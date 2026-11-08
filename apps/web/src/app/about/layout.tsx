import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Learn about Nexus Commerce — our mission, values, team, and journey redefining premium online shopping.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
