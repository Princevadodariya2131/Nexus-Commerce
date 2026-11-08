'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { formatPrice, formatRating } from '@/lib/utils';
import { fadeUp } from '@/lib/motion/variants';
import type { Product } from '@/lib/products';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = product.images[0]?.url || PLACEHOLDER;

  return (
    <motion.div variants={fadeUp}>
      <Link href={`/shop/${product.slug}`} className="glass-card block overflow-hidden group" data-cursor="view">
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
        </div>
        <div className="p-4">
          {product.category && (
            <p className="text-xs text-muted-foreground mb-1">{product.category.name}</p>
          )}
          <h3 className="font-medium truncate">{product.name}</h3>
          <div className="mt-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatPrice(product.price)}</span>
              {product.compareAtPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">★ {formatRating(product.rating)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
