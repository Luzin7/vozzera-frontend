import { useEffect, useRef, type ComponentProps } from "react";

import { Slider } from "@/components/ui/slider";

type Props = ComponentProps<typeof Slider> & {
  labelId: string;
  valueText: string;
};

export function LabeledSlider({ labelId, valueText, ...sliderProps }: Readonly<Props>) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const thumb = rootRef.current?.querySelector('[role="slider"]');
    thumb?.setAttribute("aria-labelledby", labelId);
    thumb?.setAttribute("aria-valuetext", valueText);
  }, [labelId, valueText]);

  return <Slider ref={rootRef} {...sliderProps} />;
}
