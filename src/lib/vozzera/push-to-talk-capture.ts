const CANCEL_CODE = "Escape";

export type PushToTalkCaptureEvent =
  { type: "start" } | { type: "blur" } | { type: "key"; code: string };

export type PushToTalkCaptureResult = {
  capturing: boolean;
  boundCode?: string;
};

export function reducePushToTalkCapture(
  capturing: boolean,
  event: PushToTalkCaptureEvent,
): PushToTalkCaptureResult {
  if (event.type === "start") return { capturing: true };
  if (event.type === "blur") return { capturing: false };
  if (!capturing || event.code === CANCEL_CODE) return { capturing: false };
  return { capturing: false, boundCode: event.code };
}
