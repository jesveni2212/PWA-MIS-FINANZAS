# Shared Groups List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Integrate the protected groups page with Supabase so authenticated users can list their shared groups and see newly created groups after a confirmed refresh.

**Architecture:** Keep `/grupos` as a server-protected route and compose it with a focused client component responsible for querying `financial_spaces`. Pass an explicit reload callback into `CreateGroupForm`; the existing transactional RPC remains the sole creation path. RLS remains the authorization boundary.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Supabase browser client, Vitest and Testing Library.

## Global Constraints

- Query only `financial_spaces` rows with `kind = 'shared'` visible to the authenticated user through RLS.
- Do not use service-role credentials or direct client inserts into `memberships`.
- Preserve the existing protected-route behavior and Spanish UI copy.
- Do not implement invitations, editable roles, group detail, or shared movements.

## File Structure

- Create `src/components/groups/groups-content.tsx` for client-side loading, list, empty/error states, and reload coordination.
- Modify `src/app/grupos/page.tsx` to render the groups content inside the existing shell.
- Modify `src/components/groups/create-group-form.tsx` to accept an optional `onCreated` callback and invoke it after a successful RPC.
- Modify `tests/unit/create-group-form.test.tsx` for callback behavior.
- Create `tests/unit/groups-content.test.tsx` for query and rendering states.

### Task 1: Add the groups list client component

**Files:**
- Create: `src/components/groups/groups-content.tsx`
- Test: `tests/unit/groups-content.test.tsx`

**Interfaces:**
- Produces `GroupsContent(): JSX.Element`.
- Uses `createClient().from('financial_spaces').select('id,name,created_at').eq('kind','shared').order('created_at',{ ascending: false })`.

- [ ] **Step 1: Write failing tests** for successful rows, empty state, loading state, and query error. Mock `createClient` with a chainable query object whose terminal `order` resolves `{ data, error }`.
- [ ] **Step 2: Run `corepack pnpm test tests/unit/groups-content.test.tsx`; expect failure because the component does not exist.**
- [ ] **Step 3: Implement `GroupsContent`** with `useEffect`, `loading`, `groups`, and `error` state. Render an `aria-live="polite"` loading message, a generic retryable error, an empty message, or a semantic list of names. Expose `onCreated` internally by reloading after the form succeeds.
- [ ] **Step 4: Run the focused test and expect all cases to pass.**
- [ ] **Step 5: Commit with `git add src/components/groups/groups-content.tsx tests/unit/groups-content.test.tsx; git commit -m "feat: list accessible shared groups"`.**

### Task 2: Connect creation success to list refresh

**Files:**
- Modify: `src/components/groups/create-group-form.tsx`
- Modify: `src/components/groups/groups-content.tsx`
- Test: `tests/unit/create-group-form.test.tsx`

**Interfaces:**
- `CreateGroupForm({ onCreated }: { onCreated?: () => void | Promise<void> }): JSX.Element`.

- [ ] **Step 1: Add a failing test** rendering `CreateGroupForm` with `onCreated={vi.fn()}` and asserting it is called once after a successful RPC.
- [ ] **Step 2: Run the focused test and expect the callback assertion to fail.**
- [ ] **Step 3: Invoke `await onCreated?.()` only after the RPC returns both `data` and no `error`; preserve the existing success message and keep the callback outside the failure branch.**
- [ ] **Step 4: Pass the list reload function from `GroupsContent` to the form and run both focused test files.**
- [ ] **Step 5: Commit with `git add src/components/groups/create-group-form.tsx src/components/groups/groups-content.tsx tests/unit/create-group-form.test.tsx; git commit -m "feat: refresh groups after creation"`.**

### Task 3: Integrate the page and run the quality gate

**Files:**
- Modify: `src/app/grupos/page.tsx`
- Test: `tests/unit/groups-content.test.tsx`, `tests/unit/create-group-form.test.tsx`

- [ ] **Step 1: Replace the placeholder page copy** with the existing protected shell plus a heading, short explanation, and `<GroupsContent />`.
- [ ] **Step 2: Add an integration assertion** that the page renders the group heading and list component content without exposing the personal-space name.
- [ ] **Step 3: Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build`; expect exit code 0.**
- [ ] **Step 4: Inspect `git status --short` and confirm only intentional project changes remain.**
- [ ] **Step 5: Commit with `git add src/app/grupos/page.tsx tests/unit/groups-content.test.tsx; git commit -m "feat: connect shared groups page"`.**

## Plan Self-Review

- **Spec coverage:** query/RLS boundary and list states are Task 1; post-create refresh and error preservation are Task 2; page integration and quality checks are Task 3.
- **Placeholder scan:** no TBD, TODO, or unspecified implementation steps remain.
- **Type consistency:** the callback type is shared by the form and list; the Supabase query shape uses `id`, `name`, and `created_at` consistently.
