import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupsContent } from "@/components/groups/groups-content";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

afterEach(() => {
  cleanup();
  mockedCreateClient.mockReset();
});

function mockQuery(result: PromiseLike<{ data: unknown; error: unknown }>) {
  const order = vi.fn().mockReturnValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  mockedCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as never);
  return { select, eq, order };
}

describe("GroupsContent", () => {
  it("queries and renders shared groups", async () => {
    const query = mockQuery(Promise.resolve({
      data: [{ id: "group-1", name: "Casa", created_at: "2026-08-27T10:00:00Z" }],
      error: null,
    }));

    render(<GroupsContent />);

    expect(await screen.findByText("Casa")).toBeInTheDocument();
    expect(query.select).toHaveBeenCalledWith("id,name,created_at");
    expect(query.eq).toHaveBeenCalledWith("kind", "shared");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByRole("list", { name: "Lista de grupos compartidos" })).toBeInTheDocument();
  });

  it("shows an understandable empty state", async () => {
    mockQuery(Promise.resolve({ data: [], error: null }));

    render(<GroupsContent />);

    expect(await screen.findByText("Todavía no tenés grupos compartidos.")).toBeInTheDocument();
  });

  it("shows loading while the query is pending", () => {
    mockQuery(new Promise(() => undefined));

    render(<GroupsContent />);

    expect(screen.getByText("Cargando grupos compartidos…")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no tenés grupos compartidos.")).not.toBeInTheDocument();
  });

  it("shows a generic retryable error when the query fails", async () => {
    mockQuery(Promise.resolve({ data: null, error: { message: "network failure" } }));

    render(<GroupsContent />);

    expect(await screen.findByText("No pudimos cargar tus grupos. Volvé a intentar.")).toBeInTheDocument();
    expect(screen.queryByText("network failure")).not.toBeInTheDocument();
  });
});
