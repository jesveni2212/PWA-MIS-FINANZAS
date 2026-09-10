export type RecurrenceType = "weekly" | "monthly" | "annual" | "custom";

export type RecurrenceRule =
  | { type: "weekly"; weekday: number }
  | { type: "monthly"; day: number }
  | { type: "annual"; month: number; day: number }
  | { type: "custom"; interval: number; unit: "days" | "weeks" | "months" };

export type ReminderOccurrenceStatus = "pending" | "paid" | "omitted";

export type ReminderOccurrence = {
  id: string;
  reminderId: string;
  dueOn: string;
  status: ReminderOccurrenceStatus;
  resolvedAt: string | null;
};

export type Reminder = {
  id: string;
  name: string;
  category: string | null;
  amount: number | null;
  currency: "PYG" | "USD" | null;
  recurrenceType: RecurrenceType;
  recurrenceRule: RecurrenceRule;
  startDate: string;
  nextDueOn: string;
  notifyDaysBefore: number;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReminderWithOccurrence = {
  reminder: Reminder;
  occurrence: ReminderOccurrence | null;
};

export type ReminderDraft = {
  name: string;
  category: string | null;
  amount: number | null;
  currency: "PYG" | "USD" | null;
  recurrenceRule: RecurrenceRule;
  startDate: string;
  notifyDaysBefore: number;
  timezone: string;
};

export type ReminderUpdate = ReminderDraft & {
  id: string;
  active: boolean;
};
