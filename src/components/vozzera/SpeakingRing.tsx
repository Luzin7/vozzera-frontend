import type { ReactNode } from "react";

import { useIsSpeaking } from "@/lib/vozzera/speaking-store";

type Props = {
  identity: string;
  baseClassName: string;
  speakingClassName: string;
  idleClassName: string;
  children: ReactNode;
};

export function SpeakingRing({
  identity,
  baseClassName,
  speakingClassName,
  idleClassName,
  children,
}: Readonly<Props>) {
  const isSpeaking = useIsSpeaking(identity);
  return (
    <span className={`${baseClassName} ${isSpeaking ? speakingClassName : idleClassName}`}>
      {children}
    </span>
  );
}
