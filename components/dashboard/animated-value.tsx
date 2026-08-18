"use client";

import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { cn } from "@/lib/utils";

interface AnimatedValueProps {
  value: number;
  format: (value: number) => string;
  className?: string;
}

export function AnimatedValue({ value, format, className }: AnimatedValueProps) {
  const animated = useAnimatedNumber(value);
  return <span className={cn("num", className)}>{format(animated)}</span>;
}
