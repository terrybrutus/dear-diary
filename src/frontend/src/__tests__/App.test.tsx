import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { KEY, emptyJournal } from "../journal";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ configured: false }),
      }),
  );
});
describe("Local journal workflows", () => {
  it("saves a reflection and trade, derives metrics, and restores them on remount", async () => {
    const user = userEvent.setup(),
      view = render(<App />);
    await user.click(screen.getByRole("button", { name: "New journal entry" }));
    let dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Followed my plan");
    await user.type(
      within(dialog).getByLabelText("Reflection"),
      "Waited patiently for my setup.",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save entry" }),
    );
    expect(
      within(dialog).getByRole("heading", { name: "Followed my plan" }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Trades" }));
    await user.type(within(dialog).getByLabelText("Symbol"), "NQ");
    await user.type(
      within(dialog).getByLabelText(/Net P\/L/, { selector: "input" }),
      "250",
    );
    const risk = within(dialog).getByLabelText(/Initial risk/);
    await user.clear(risk);
    await user.type(risk, "100");
    await user.click(
      within(dialog).getByRole("button", { name: "Save trade" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Close day" }));
    expect(JSON.parse(localStorage.getItem(KEY)!).trades[0].pnl).toBe(250);
    expect(screen.getByText("+2.50R")).toBeInTheDocument();
    view.unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(
      screen.getByRole("heading", { name: "Followed my plan" }),
    ).toBeInTheDocument();
  });
  it("edits and deletes persisted trades and searches losing days with real navigation", async () => {
    const d = emptyJournal();
    d.trades = [
      {
        id: "t1",
        date: "2026-11-05",
        symbol: "ES",
        side: "Short",
        pnl: -100,
        risk: 50,
        setup: "Reversal",
        notes: "",
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(d));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Ask your journal" }));
    await user.click(
      screen.getByRole("button", { name: "Show my losing days" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "November 5, 2026" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("November 5, 2026");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Trades",
      }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Edit ES",
      }),
    );
    const pnl = within(screen.getByRole("dialog")).getByLabelText(/Net P\/L/, {
      selector: "input",
    });
    await user.clear(pnl);
    await user.type(pnl, "75");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Save trade",
      }),
    );
    expect(JSON.parse(localStorage.getItem(KEY)!).trades[0].pnl).toBe(75);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete ES",
      }),
    );
    expect(JSON.parse(localStorage.getItem(KEY)!).trades).toEqual([]);
  });
  it("provides all sidebar workflows and saves setups, tags, and goal progress", async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const name of [
      "Analytics",
      "AI Insights",
      "Reports",
      "Import / Sync",
      "Settings",
    ]) {
      await user.click(screen.getByRole("button", { name }));
      expect(
        screen.getByRole("heading", { level: 1, name }),
      ).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Playbook" }));
    await user.type(screen.getByLabelText("Setup name"), "ORB");
    await user.type(
      screen.getByLabelText("Entry, exit, and risk rules"),
      "Wait for retest",
    );
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    await user.click(screen.getByRole("button", { name: "Tags & Setups" }));
    await user.type(screen.getByLabelText("New tag"), "Patient");
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.click(screen.getByRole("button", { name: "Goals" }));
    await user.type(screen.getByLabelText("Goal name"), "Reflect daily");
    await user.type(screen.getByLabelText("Goal target"), "2");
    await user.click(screen.getByRole("button", { name: "Add goal" }));
    await user.click(screen.getByRole("button", { name: "Log progress" }));
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.plays[0].name).toBe("ORB");
    expect(saved.tags).toEqual(["Patient"]);
    expect(saved.goals[0].current).toBe(1);
  });
  it("blocks overwrites when another tab changes journal storage", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent(window, new StorageEvent("storage", { key: KEY }));
    await user.click(screen.getByRole("button", { name: "New journal entry" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "A note");
    await user.type(within(dialog).getByLabelText("Reflection"), "x");
    await user.click(
      within(dialog).getByRole("button", { name: "Save entry" }),
    );
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
