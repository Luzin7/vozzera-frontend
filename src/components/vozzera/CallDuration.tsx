import { formatCallDuration } from "@/lib/vozzera/call-duration";
import { useNow } from "@/lib/vozzera/clock-store";

type Props = {
  startedAt: number | null;
  className?: string;
};

type TimerProps = {
  startedAt: number;
  className?: string | undefined;
};

function CallDurationTimer({ startedAt, className }: Readonly<TimerProps>) {
  const now = useNow();

  return (
    <span role="timer" aria-label="Duração da chamada" className={className}>
      {formatCallDuration(now - startedAt)}
    </span>
  );
}

export function CallDuration({ startedAt, className }: Readonly<Props>) {
  if (startedAt === null) return null;

  return <CallDurationTimer startedAt={startedAt} className={className} />;
}
