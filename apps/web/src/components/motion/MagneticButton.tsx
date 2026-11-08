'use client';

import { useMagnetic } from '@/hooks/useMagnetic';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MagneticButton({ className, children, ...props }: ButtonProps) {
  const { ref, handleMouseMove, handleMouseLeave } = useMagnetic(0.25);

  return (
    <Button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={cn('magnetic-btn', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-cursor="pointer"
      {...props}
    >
      {children}
    </Button>
  );
}
