import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReminder, normalizeReminderRow, resolveReminderOccurrence } from "@/lib/reminders/repository";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => mockedCreateClient.mockReset());

describe("reminder repository", () => {
  it("normalizes database rows and nested occurrences", () => {
    expect(normalizeReminderRow({
      id: "reminder-1", name: "Luz", category: "Servicios", amount: "50000", currency: "PYG", recurrence_type: "monthly", recurrence_config: { day: 31 }, start_date: "2026-09-01", next_due_on: "2026-09-30", notify_days_before: 3, timezone: "America/Asuncion", active: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", financial_reminder_occurrences: [{ id: "occ-1", due_on: "2026-09-30", status: "pending", resolved_at: null }],
    })).toMatchObject({ reminder: { amount: 50000, recurrenceType: "monthly", recurrenceRule: { day: 31 } }, occurrence: { id: "occ-1", status: "pending" } });
  });

  it("maps create and resolve calls to the owner RPCs", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "reminder-1", error: null });
    mockedCreateClient.mockReturnValue({ rpc } as never);

    await expect(createReminder({ name: "Agua", category: "Servicios", amount: null, currency: null, recurrenceRule: { type: "monthly", day: 10 }, startDate: "2026-09-10", notifyDaysBefore: 1, timezone: "America/Asuncion" })).resolves.toBe("reminder-1");
    await resolveReminderOccurrence("occ-1", "paid");
    expect(rpc).toHaveBeenNthCalledWith(1, "create_personal_reminder", expect.objectContaining({ p_recurrence_config: { day: 10 } }));
    expect(rpc).toHaveBeenNthCalledWith(2, "resolve_personal_reminder_occurrence", { p_occurrence_id: "occ-1", p_status: "paid" });
  });
});
