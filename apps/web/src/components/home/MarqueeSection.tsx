'use client';

const brands = ['NIKE', 'TESLA', 'APPLE', 'STRIPE', 'LINEAR', 'VERCEL', 'SHOPIFY', 'NEXUS'];

export function MarqueeSection() {
  return (
    <section className="py-12 border-y border-white/5 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...brands, ...brands].map((brand, i) => (
          <span
            key={`${brand}-${i}`}
            className="mx-12 text-2xl font-display font-bold text-white/20 tracking-widest"
          >
            {brand}
          </span>
        ))}
      </div>
    </section>
  );
}
