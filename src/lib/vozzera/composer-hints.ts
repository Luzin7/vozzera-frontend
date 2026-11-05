const COUNTER_VISIBLE_RATIO = 0.9;

export function shouldShowSendHint({
  focused,
  empty,
}: Readonly<{ focused: boolean; empty: boolean }>): boolean {
  return focused && empty;
}

export function shouldShowCharCounter(length: number, limit: number): boolean {
  return length > limit * COUNTER_VISIBLE_RATIO;
}
