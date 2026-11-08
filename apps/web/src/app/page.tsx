import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { MarqueeSection } from '@/components/home/MarqueeSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <MarqueeSection />
      <FeaturedProducts />
    </>
  );
}
