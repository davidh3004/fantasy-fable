"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

type RangeSliderProps = {
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  min: number;
  max: number;
  step?: number;
  /** Accessible label per thumb, by index (0 = lower, 1 = upper). */
  thumbLabel: (index: number) => string;
  /** Renders the value a screen reader announces, e.g. formatted money. */
  formatValue?: (value: number) => string;
  className?: string;
};

/**
 * Two-thumb range slider.
 *
 * Thumbs are sized past the 24px touch-target floor and the track carries
 * generous vertical padding, so dragging works on a phone without the hit area
 * spilling into neighbouring controls.
 */
export function RangeSlider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  thumbLabel,
  formatValue,
  className,
}: RangeSliderProps) {
  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={(next) => onValueChange(next as [number, number])}
      min={min}
      max={max}
      step={step}
      // Keeps the thumbs from crossing into an inverted range.
      minStepsBetweenValues={1}
      className={cn("w-full", className)}
    >
      <SliderPrimitive.Control className="flex w-full cursor-pointer touch-none items-center py-2 select-none">
        <SliderPrimitive.Track className="h-1.5 w-full rounded-full bg-border">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          {[0, 1].map((index) => (
            <SliderPrimitive.Thumb
              key={index}
              index={index}
              getAriaLabel={thumbLabel}
              getAriaValueText={(formatted, raw) =>
                formatValue ? formatValue(raw) : formatted
              }
              className="size-5 rounded-full border-2 border-primary bg-background shadow transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-110"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
