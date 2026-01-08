"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, onValueChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      onValueChange?.(value);
      props.onChange?.(e);
    };

    return (
      <input
        type="range"
        className={cn(
          "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:cursor-pointer",
          "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
