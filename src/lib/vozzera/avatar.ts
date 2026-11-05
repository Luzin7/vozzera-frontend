export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export const AVATAR_COLOR_CLASSES = [
  "bg-avatar-1 text-background",
  "bg-avatar-2 text-background",
  "bg-avatar-3 text-background",
  "bg-avatar-4 text-background",
  "bg-avatar-5 text-background",
] as const;

export function avatarColorClass(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (
    AVATAR_COLOR_CLASSES[(hash >>> 0) % AVATAR_COLOR_CLASSES.length] ?? AVATAR_COLOR_CLASSES[0]
  );
}
