import { initials } from "@/lib/vozzera/avatar";
import type { OnlineUsers } from "@/lib/vozzera/chat";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onlineUsers: OnlineUsers;
  currentUserId: string | null;
};

function sortUsersByUsername(users: Array<{ userId: string; username: string }>) {
  return [...users].sort((a, b) =>
    a.username.localeCompare(b.username, "pt-BR", { sensitivity: "base" }),
  );
}

export function MemberList({ className, onlineUsers, currentUserId }: Readonly<Props>) {
  const users = sortUsersByUsername(Object.values(onlineUsers));

  return (
    <aside
      className={cn(
        "flex w-48 shrink-0 flex-col border-l border-border bg-sidebar py-3",
        className,
      )}
    >
      <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Membros — {users.length}
      </h2>
      {users.length === 0 && (
        <p className="px-3 text-xs text-muted-foreground">Nenhum membro online.</p>
      )}
      <nav className="flex-1 overflow-y-auto px-2">
        <ul aria-label="Membros online" className="space-y-0.5">
          {users.map((user) => (
            <li key={user.userId}>
              <span className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-sidebar-accent/60">
                <span className="relative shrink-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-semibold text-foreground">
                    {initials(user.username)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-sidebar bg-primary"
                  />
                </span>
                <span className="truncate text-sidebar-foreground">{user.username}</span>
                {user.userId === currentUserId && (
                  <span className="shrink-0 text-muted-foreground">(você)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
