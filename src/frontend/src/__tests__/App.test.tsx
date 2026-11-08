import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { backendInterface } from "@/backend";
import { UserRole } from "@/backend";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "@/App";
import { renderWithActor } from "./test-utils";

const APP_NAME = "Dear Diary";

function makeActor(
  overrides: Partial<Pick<backendInterface, "getCallerUserRole">> = {},
) {
  const getCallerUserRole = vi.fn<backendInterface["getCallerUserRole"]>(
    async () => UserRole.guest,
  );
  const actor = {
    getCallerUserRole,
    ...overrides,
  } satisfies Pick<backendInterface, "getCallerUserRole">;
  return { actor, getCallerUserRole };
}

describe("App placeholder page", () => {
  it("renders the app name and landing copy without a blank screen", async () => {
    const { actor } = makeActor();
    renderWithActor(<App />, actor);

    expect(screen.getByRole("heading", { name: APP_NAME })).toBeInTheDocument();
    expect(
      screen.getByText("A quiet place to keep your personal trading journal."),
    ).toBeInTheDocument();
    // The header also carries the app name.
    expect(screen.getAllByText(APP_NAME).length).toBeGreaterThanOrEqual(2);
  });

  it("sets the browser tab title to exactly the app name", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    expect(title).toBe(APP_NAME);
  });

  it("confirms the backend is reachable by calling the generated actor", async () => {
    const { actor, getCallerUserRole } = makeActor();
    renderWithActor(<App />, actor);

    expect(
      await screen.findByTestId("backend.success_state"),
    ).toHaveTextContent("Backend reachable");
    expect(getCallerUserRole).toHaveBeenCalledTimes(1);
  });

  it("shows a non-blank error state when the backend call rejects", async () => {
    const { actor } = makeActor({
      getCallerUserRole: vi.fn<backendInterface["getCallerUserRole"]>(
        async () => {
          throw new Error("unreachable");
        },
      ),
    });
    renderWithActor(<App />, actor);

    // The hook retries once, so the error state appears after the retry backoff.
    expect(
      await screen.findByTestId("backend.error_state", {}, { timeout: 5000 }),
    ).toHaveTextContent("Backend not reachable");
    // The placeholder content still renders, so the page is never blank.
    expect(screen.getByRole("heading", { name: APP_NAME })).toBeInTheDocument();
  });

  it("renders the placeholder without any navigation or extra sections", async () => {
    const { actor } = makeActor();
    renderWithActor(<App />, actor);

    await waitFor(() =>
      expect(screen.getByTestId("backend.success_state")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the same app name in the header brand and the hero heading", async () => {
    const { actor } = makeActor();
    renderWithActor(<App />, actor);

    const heading = screen.getByRole("heading", { level: 1 });
    const brand = screen.getByText(heading.textContent ?? "", {
      selector: "header span",
    });

    // The name is duplicated across two independent constants; the rename must
    // keep both surfaces in agreement rather than updating only one.
    expect(brand).toHaveTextContent(heading.textContent ?? "");
    expect(heading.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("renders the caffeine.ai attribution link in the footer", async () => {
    const { actor } = makeActor();
    renderWithActor(<App />, actor);

    const link = screen.getByRole("link", { name: /caffeine\.ai/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("caffeine.ai"),
    );
  });

  it("shows the loading state before the backend call resolves", async () => {
    const { actor } = makeActor();
    renderWithActor(<App />, actor);

    expect(screen.getByTestId("backend.loading_state")).toBeInTheDocument();
    expect(
      await screen.findByTestId("backend.success_state"),
    ).toBeInTheDocument();
  });
});
