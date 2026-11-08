import { Layout } from "@/components/Layout";
import { useBackendReachable } from "@/hooks/useQueries";

const APP_NAME = "Dear Diary";

function BackendStatus() {
  const { isPending, isError, data } = useBackendReachable();

  if (isPending) {
    return (
      <output
        data-ocid="backend.loading_state"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span
          aria-hidden="true"
          className="size-2 animate-pulse rounded-full bg-muted-foreground"
        />
        Checking backend…
      </output>
    );
  }

  if (isError || !data) {
    return (
      <p
        data-ocid="backend.error_state"
        className="inline-flex items-center gap-2 text-sm text-destructive"
      >
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-destructive"
        />
        Backend not reachable
      </p>
    );
  }

  return (
    <p
      data-ocid="backend.success_state"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
      Backend reachable
    </p>
  );
}

export default function App() {
  return (
    <Layout>
      <section
        data-ocid="home.page"
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center"
      >
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          A quiet place to keep your personal trading journal.
        </p>
        <BackendStatus />
      </section>
    </Layout>
  );
}
