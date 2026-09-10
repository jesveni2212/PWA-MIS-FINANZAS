import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemindersContent } from "@/components/reminders/reminders-content";
import type { ReminderWithOccurrence } from "@/lib/reminders/types";

const { deleteReminder, loadReminders, postponeReminderOccurrence, resolveReminderOccurrence } = vi.hoisted(() => ({ deleteReminder: vi.fn(), loadReminders: vi.fn(), postponeReminderOccurrence: vi.fn(), resolveReminderOccurrence: vi.fn() }));
vi.mock("@/lib/reminders/repository", () => ({ deleteReminder, loadReminders, postponeReminderOccurrence, resolveReminderOccurrence, createReminder: vi.fn(), updateReminder: vi.fn() }));

const pendingReminder: ReminderWithOccurrence = {
  reminder: { id: "reminder-1", name: "Luz", category: "Servicios", amount: 50000, currency: "PYG", recurrenceType: "monthly", recurrenceRule: { type: "monthly", day: 31 }, startDate: "2026-09-01", nextDueOn: "2026-09-30", notifyDaysBefore: 3, timezone: "America/Asuncion", active: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" },
  occurrence: { id: "occ-1", reminderId: "reminder-1", dueOn: "2999-09-30", status: "pending", resolvedAt: null },
};

beforeEach(() => {
  loadReminders.mockResolvedValue([pendingReminder]);
  resolveReminderOccurrence.mockResolvedValue(undefined);
  postponeReminderOccurrence.mockResolvedValue(undefined);
  deleteReminder.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe("RemindersContent", () => {
  it("groups pending reminders and exposes paid/omit/postpone actions", () => {
    render(<RemindersContent initialReminders={[pendingReminder]} />);
    expect(screen.getByRole("heading", { name: "Próximos" })).toBeInTheDocument();
    expect(screen.getByText("Luz")).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como pagado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Omitir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Posponer" })).toBeInTheDocument();
  });

  it("resolves an occurrence without touching personal transactions", async () => {
    render(<RemindersContent initialReminders={[pendingReminder]} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar como pagado" }));
    await waitFor(() => expect(resolveReminderOccurrence).toHaveBeenCalledWith("occ-1", "paid"));
    expect(loadReminders).toHaveBeenCalled();
  });

  it("allows postponing the concrete occurrence", async () => {
    render(<RemindersContent initialReminders={[pendingReminder]} />);
    fireEvent.change(screen.getByLabelText("Nueva fecha"), { target: { value: "2999-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Posponer" }));
    await waitFor(() => expect(postponeReminderOccurrence).toHaveBeenCalledWith("occ-1", "2999-10-01"));
  });

  it("deletes a reminder permanently after confirmation", async () => {
    render(<RemindersContent initialReminders={[pendingReminder]} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Luz" }));
    expect(screen.getByRole("dialog", { name: "¿Eliminar “Luz”?" })).toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    await waitFor(() => expect(deleteReminder).toHaveBeenCalledWith("reminder-1"));
    expect(screen.queryByText("Luz")).not.toBeInTheDocument();
  });
});
