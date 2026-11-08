import type { ReactNode } from "react";

const APP_NAME = "Dear Diary";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {children}
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-sm text-muted-foreground">
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
              window.location.hostname,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            © {new Date().getFullYear()}. Built with love using caffeine.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
