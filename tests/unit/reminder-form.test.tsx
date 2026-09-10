import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReminderForm } from "@/components/reminders/reminder-form";

const { createReminder, updateReminder } = vi.hoisted(() => ({ createReminder: vi.fn(), updateReminder: vi.fn() }));
vi.mock("@/lib/reminders/repository", () => ({ createReminder, updateReminder }));

beforeEach(() => { createReminder.mockResolvedValue("reminder-1"); updateReminder.mockResolvedValue(undefined); });
afterEach(() => cleanup());

describe("ReminderForm", () => {
  it("starts monthly and exposes every recurrence-specific field", () => {
    render(<ReminderForm onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Repetición")).toHaveValue("monthly");
    expect(screen.getByLabelText("Día del mes")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repetición"), { target: { value: "weekly" } });
    expect(screen.getByLabelText("Día de la semana")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repetición"), { target: { value: "annual" } });
    expect(screen.getByLabelText("Mes")).toBeInTheDocument();
    expect(screen.getByLabelText("Día")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repetición"), { target: { value: "custom" } });
    expect(screen.getByLabelText("Cada")).toBeInTheDocument();
    expect(screen.getByLabelText("Unidad")).toBeInTheDocument();
  });

  it("rejects invalid input before calling Supabase", async () => {
    render(<ReminderForm onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar recordatorio" }).closest("form")!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(createReminder).not.toHaveBeenCalled();
  });

  it("sends a monthly day-31 rule and optional amount", async () => {
    const onSaved = vi.fn();
    render(<ReminderForm onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Luz" } });
    fireEvent.change(screen.getByLabelText("Día del mes"), { target: { value: "31" } });
    fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: "50000" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar recordatorio" }).closest("form")!);
    await waitFor(() => expect(createReminder).toHaveBeenCalledWith(expect.objectContaining({ name: "Luz", amount: 50000, recurrenceRule: { type: "monthly", day: 31 } })));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
