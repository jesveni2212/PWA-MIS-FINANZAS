# Personal Ledger Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar un rediseño nocturno editorial y un libro contable personal seguro que distinga dinero disponible, deuda de tarjetas, transferencias y pagos de tarjeta sin duplicar gastos.

**Architecture:** Se conserva `financial_spaces` y la lógica de grupos compartidos. Las cuentas personales se amplían desde `accounts`; las operaciones personales se registran por una RPC transaccional y se proyectan como movimientos legibles. Los componentes de cliente consumen una capa tipada de consulta/mutación, mientras la política RLS y la RPC verifican propiedad en la base de datos.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase PostgreSQL/RLS/RPC, Vitest y Playwright.

## Global Constraints

- Mantener grupos compartidos fuera de todos los cálculos de patrimonio personal.
- No almacenar ni subir fotos de facturas; el detalle de compra es exclusivamente estructurado.
- No usar claves de servicio en navegador ni ocultar errores de TypeScript.
- Usar una única RPC para cada operación personal de doble efecto, especialmente transferencias y pagos de tarjeta.
- Mantener las variables de Supabase fuera de Git y no ejecutar `db push` sin un dry-run revisado y autorización explícita.

---

### Task 1: Definir el libro contable personal seguro

**Files:**
- Create: `supabase/migrations/20260901090000_personal_ledger.sql`
- Create: `supabase/tests/personal_ledger_security.sql`
- Modify: `supabase/tests/movements_security.sql`

**Interfaces:**
- Consumes: `financial_spaces`, `memberships`, `accounts`, `profiles` y `auth.uid()`.
- Produces: cuentas con `account_type`, `institution` y saldo inicial; `personal_transactions`, `purchase_items`; RPC `record_personal_transaction(...)`; vista `personal_account_balances`.

- [ ] **Step 1: Escribir las pruebas pgTAP que describen cada efecto contable.**

```sql
select lives_ok(
  $$select public.record_personal_transaction('expense', :cash_id, null, 50000, current_date, 'Comida', null, null, 'Biggie', '[]'::jsonb)$$,
  'an expense reduces the source available account'
);
select lives_ok(
  $$select public.record_personal_transaction('card_purchase', :credit_id, null, 150000, current_date, 'Comida', null, null, 'Biggie', '[]'::jsonb)$$,
  'a card purchase increases debt without reducing available cash'
);
select lives_ok(
  $$select public.record_personal_transaction('card_payment', :cash_id, :credit_id, 150000, current_date, 'Pago tarjeta', null, null, null, '[]'::jsonb)$$,
  'a card payment reduces available cash and credit-card debt once'
);
```

- [ ] **Step 2: Ejecutar la suite para confirmar que falla antes de la migración.**

Run: `npx.cmd supabase@latest test db supabase/tests/personal_ledger_security.sql`

Expected: falla porque la RPC y las columnas aún no existen; si Docker no está disponible, registrar el bloqueo y continuar con las pruebas unitarias hasta que pueda ejecutarse localmente.

- [ ] **Step 3: Crear la migración con esquema, RLS y RPC atómica.**

```sql
alter table public.accounts
  add column account_type text not null default 'bank'
    check (account_type in ('cash', 'bank', 'credit_card')),
  add column institution text not null default 'Otro',
  add column opening_debt numeric(14, 2) not null default 0
    check (opening_debt >= 0);

create table public.personal_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  personal_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  operation_type text not null check (operation_type in ('income', 'expense', 'card_purchase', 'transfer', 'card_payment')),
  source_account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null,
  category text,
  note text,
  merchant text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.purchase_items (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_id uuid not null references public.personal_transactions(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0)
);
```

Implement `record_personal_transaction` as `security definer`, with an explicit `search_path`, authenticated owner checks for every referenced account, and a `jsonb` array of `{description, quantity, unit_price}` items. The function must reject invalid account combinations with `22023`, insert transaction and items atomically, and return the created transaction id.

- [ ] **Step 4: Crear la vista de saldos derivada.**

```sql
create view public.personal_account_balances with (security_invoker = true) as
select
  a.id,
  a.space_id,
  a.account_type,
  a.institution,
  a.name,
  a.currency,
  case when a.account_type = 'credit_card'
    then a.opening_debt
      + coalesce(sum(case when t.operation_type = 'card_purchase' and t.source_account_id = a.id then t.amount
                          when t.operation_type = 'card_payment' and t.destination_account_id = a.id then -t.amount
                          else 0 end), 0)
    else a.initial_balance
      + coalesce(sum(case when t.operation_type = 'income' and t.destination_account_id = a.id then t.amount
                          when t.operation_type in ('expense', 'transfer', 'card_payment') and t.source_account_id = a.id then -t.amount
                          when t.operation_type = 'transfer' and t.destination_account_id = a.id then t.amount
                          else 0 end), 0)
  end as current_balance
from public.accounts a
left join public.personal_transactions t on a.id in (t.source_account_id, t.destination_account_id)
group by a.id;
```

- [ ] **Step 5: Ejecutar la suite pgTAP y revisar seguridad.**

Run: `npx.cmd supabase@latest test db supabase/tests/personal_ledger_security.sql`

Expected: cada operación actualiza solamente las cuentas correctas; un usuario ajeno recibe `42501`; no se inserta ninguna fila parcial.

- [ ] **Step 6: Confirmar la migración aislada.**

Run: `git add supabase/migrations/20260901090000_personal_ledger.sql supabase/tests/personal_ledger_security.sql supabase/tests/movements_security.sql && git commit -m "feat: add personal ledger transactions"`

Expected: un commit con esquema, RPC y pruebas de autorización exclusivamente.

### Task 2: Crear tipos, catálogo de entidades y capa de datos personal

**Files:**
- Create: `src/lib/finance/institutions.ts`
- Create: `src/lib/finance/types.ts`
- Create: `src/lib/finance/personal-ledger.ts`
- Test: `tests/unit/personal-ledger.test.ts`

**Interfaces:**
- Produces: `AccountType`, `OperationType`, `PersonalAccount`, `PersonalTransaction`, `PurchaseItemDraft`, `PARAGUAYAN_INSTITUTIONS`, `loadPersonalLedger()` y `recordPersonalTransaction()`.

- [ ] **Step 1: Escribir pruebas de transformación y validación.**

```ts
expect(normalizePurchaseItems([{ description: "  Leche ", quantity: "2", unitPrice: "8500" }]))
  .toEqual([{ description: "Leche", quantity: 2, unitPrice: 8500 }]);
expect(validateOperationAccounts("card_payment", "cash-1", "credit-1", accounts)).toBeNull();
expect(validateOperationAccounts("card_payment", "credit-1", "cash-1", accounts)).toMatch(/origen/i);
```

- [ ] **Step 2: Ejecutar la prueba enfocada y confirmar el fallo.**

Run: `corepack pnpm test tests/unit/personal-ledger.test.ts`

Expected: falla porque los módulos no existen.

- [ ] **Step 3: Implementar tipos y catálogo.**

```ts
export const PARAGUAYAN_INSTITUTIONS = ["Ueno", "GNB", "Itaú", "Continental", "Coomecipar", "Fic de Finanzas", "Mango", "Eko"] as const;
export type AccountType = "cash" | "bank" | "credit_card";
export type OperationType = "income" | "expense" | "card_purchase" | "transfer" | "card_payment";
export type PurchaseItemDraft = { description: string; quantity: string; unitPrice: string };
```

`personal-ledger.ts` debe obtener la cuenta personal, consultar `personal_account_balances` y transacciones/ítems de esa cuenta, y llamar `client.rpc("record_personal_transaction", payload)` para mutaciones. Sus mensajes de error deben ser genéricos y nunca reenviar errores internos de Supabase a la interfaz.

- [ ] **Step 4: Ejecutar pruebas enfocadas.**

Run: `corepack pnpm test tests/unit/personal-ledger.test.ts`

Expected: PASS.

- [ ] **Step 5: Confirmar el módulo.**

Run: `git add src/lib/finance tests/unit/personal-ledger.test.ts && git commit -m "feat: add personal ledger client module"`

Expected: tipos, catálogo y capa de datos sin componentes visuales.

### Task 3: Establecer el sistema visual nocturno editorial y navegación

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/site.ts`
- Create: `src/components/ui/icon.tsx`
- Create: `src/components/ui/money-value.tsx`
- Test: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Produces: tokens `--ink`, `--panel`, `--line`, `--signal`, componentes `Icon` y `MoneyValue` con prop `hidden`.

- [ ] **Step 1: Añadir pruebas de navegación y ocultamiento.**

```tsx
render(<MoneyValue amount={4680000} currency="PYG" hidden />);
expect(screen.getByText("••••••")).toBeInTheDocument();
render(<AppShell><p>Contenido</p></AppShell>);
expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
expect(screen.getByRole("link", { name: "Cuentas" })).toHaveAttribute("href", "/cuentas");
```

- [ ] **Step 2: Implementar tokens, tipografía y superficies.**

```css
:root { --ink:#0d0f0d; --panel:#171a17; --panel-raised:#202520; --line:#343b33; --text:#f4f4ed; --muted:#9da69b; --signal:#baff7b; --danger:#ffb28b; }
body { background:var(--ink); color:var(--text); }
```

El shell debe mostrar navegación móvil fija con Inicio, Cuentas, Movimientos, Grupos y Perfil; en escritorio debe mostrar una barra lateral compacta. El estado de ocultar saldos se persiste en `localStorage` y se expone con un botón accesible `Mostrar saldos`/`Ocultar saldos`.

- [ ] **Step 3: Ejecutar las pruebas de shell y accesibilidad.**

Run: `corepack pnpm test tests/unit/app-shell.test.tsx`

Expected: PASS.

- [ ] **Step 4: Confirmar el sistema visual.**

Run: `git add src/app/globals.css src/components/app-shell.tsx src/lib/site.ts src/components/ui tests/unit/app-shell.test.tsx && git commit -m "feat: add nocturnal finance design system"`

Expected: un commit visual sin cambios del modelo contable.

### Task 4: Implementar dashboard personal y gestión de cuentas

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/cuentas/page.tsx`
- Replace: `src/components/accounts/accounts-content.tsx`
- Create: `src/components/dashboard/personal-dashboard.tsx`
- Create: `src/components/accounts/account-form.tsx`
- Create: `src/components/accounts/account-card.tsx`
- Test: `tests/unit/personal-dashboard.test.tsx`
- Test: `tests/unit/account-form.test.tsx`

**Interfaces:**
- Consumes: `loadPersonalLedger`, `PARAGUAYAN_INSTITUTIONS`, `MoneyValue`.
- Produces: dashboard con patrimonio, tarjetas por pagar, accesos y últimos movimientos; alta de disponible o crédito.

- [ ] **Step 1: Escribir pruebas del dashboard.**

```tsx
expect(await screen.findByText("Patrimonio neto")).toBeInTheDocument();
expect(screen.getByText("Tarjetas por pagar")).toBeInTheDocument();
expect(screen.getByText("Ueno · Crédito")).toBeInTheDocument();
expect(screen.getByText("Al día")).toBeInTheDocument();
```

- [ ] **Step 2: Escribir prueba del formulario de cuenta.**

```tsx
fireEvent.click(screen.getByRole("radio", { name: "Tarjeta de crédito" }));
fireEvent.selectOptions(screen.getByLabelText("Entidad"), "Otro");
expect(screen.getByLabelText("Nombre de otra entidad")).toBeVisible();
expect(screen.getByLabelText("Deuda inicial")).toBeVisible();
```

- [ ] **Step 3: Ejecutar pruebas para confirmar el fallo.**

Run: `corepack pnpm test tests/unit/personal-dashboard.test.tsx tests/unit/account-form.test.tsx`

Expected: FAIL por falta de componentes.

- [ ] **Step 4: Implementar dashboard y formulario.**

El dashboard debe calcular `netWorth = availableTotal - creditDebtTotal`, ocultar importes sin ocultar etiquetas, mostrar solo datos personales y abrir acciones rápidas hacia el compositor con el tipo preseleccionado. `AccountForm` crea cuentas solo en el espacio personal y nunca permite crear una cuenta compartida.

- [ ] **Step 5: Ejecutar pruebas enfocadas.**

Run: `corepack pnpm test tests/unit/personal-dashboard.test.tsx tests/unit/account-form.test.tsx`

Expected: PASS con estados de carga, vacío, error reintentable y éxito.

- [ ] **Step 6: Confirmar dashboard y cuentas.**

Run: `git add src/app/page.tsx src/app/cuentas/page.tsx src/components/dashboard src/components/accounts tests/unit/personal-dashboard.test.tsx tests/unit/account-form.test.tsx && git commit -m "feat: add personal finance dashboard"`

Expected: patrimonio y gestión de cuentas en un commit comprobable.

### Task 5: Reemplazar el compositor de movimientos por operaciones contables

**Files:**
- Modify: `src/app/movimientos/page.tsx`
- Replace: `src/components/movements/movements-content.tsx`
- Replace: `src/components/movements/create-movement-form.tsx`
- Create: `src/components/movements/operation-form.tsx`
- Create: `src/components/movements/purchase-item-editor.tsx`
- Create: `src/components/movements/transaction-detail.tsx`
- Modify: `tests/unit/create-movement-form.test.tsx`
- Create: `tests/unit/operation-form.test.tsx`
- Create: `tests/unit/purchase-item-editor.test.tsx`

**Interfaces:**
- Consumes: `recordPersonalTransaction`, `PersonalAccount`, `OperationType`.
- Produces: operaciones sin duplicación y detalle estructurado de compra.

- [ ] **Step 1: Escribir pruebas por operación.**

```tsx
fireEvent.change(screen.getByLabelText("Tipo de operación"), { target: { value: "card_payment" } });
expect(screen.getByLabelText("Cuenta desde la que pagás")).toBeVisible();
expect(screen.getByLabelText("Tarjeta que pagás")).toBeVisible();
expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument();
```

```tsx
fireEvent.click(screen.getByRole("button", { name: "Añadir ítem" }));
fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Leche" } });
expect(screen.getByText("Total de ítems: ₲ 17.000")).toBeInTheDocument();
```

- [ ] **Step 2: Ejecutar pruebas y confirmar el fallo.**

Run: `corepack pnpm test tests/unit/operation-form.test.tsx tests/unit/purchase-item-editor.test.tsx`

Expected: FAIL porque aún existe el formulario de ingreso/gasto simple.

- [ ] **Step 3: Implementar el formulario dinámico.**

`OperationForm` debe usar una unión discriminada por `OperationType`; al enviar, normaliza campos, llama una vez a la RPC y conserva el borrador cuando hay error. `PurchaseItemEditor` admite agregar/quitar ítems y no incluye `input type="file"` ni lógica de subida. `TransactionDetail` presenta comercio, fecha e ítems sin imágenes.

- [ ] **Step 4: Ejecutar pruebas enfocadas.**

Run: `corepack pnpm test tests/unit/create-movement-form.test.tsx tests/unit/operation-form.test.tsx tests/unit/purchase-item-editor.test.tsx`

Expected: PASS para ingreso, gasto, compra con tarjeta, transferencia, pago de tarjeta y advertencia de total distinto.

- [ ] **Step 5: Confirmar operaciones.**

Run: `git add src/app/movimientos/page.tsx src/components/movements tests/unit/create-movement-form.test.tsx tests/unit/operation-form.test.tsx tests/unit/purchase-item-editor.test.tsx && git commit -m "feat: add personal accounting operations"`

Expected: un commit sin imágenes y con un único camino de escritura personal.

### Task 6: Aplicar el sistema a grupos, perfil y pruebas de regresión

**Files:**
- Modify: `src/app/grupos/page.tsx`
- Modify: `src/components/groups/groups-content.tsx`
- Modify: `src/components/groups/create-group-form.tsx`
- Modify: `src/app/perfil/page.tsx`
- Modify: `src/components/profile/profile-form.tsx`
- Modify: `tests/unit/groups-content.test.tsx`
- Modify: `tests/unit/profile-form.test.tsx`
- Modify: `tests/e2e/public-navigation.spec.ts`

**Interfaces:**
- Consumes: componentes base nocturnos y navegación actualizada.
- Produces: pantallas coherentes que preservan las acciones y RLS existentes.

- [ ] **Step 1: Escribir una regresión de aislamiento.**

```tsx
render(<PersonalDashboard ledger={ledgerWithSharedGroup} />);
expect(screen.getByText("Patrimonio neto")).toHaveTextContent("₲ 4.680.000");
expect(screen.queryByText("Casa compartida")).not.toBeInTheDocument();
```

- [ ] **Step 2: Implementar sólo cambios de composición visual.**

Los grupos deben portar una etiqueta `Compartido`, conservar creación/reintento/listado y no consultar balances personales. Perfil debe conservar la edición de `display_name` y añadir únicamente el control local de privacidad de saldos si se comparte con el shell.

- [ ] **Step 3: Ejecutar regresiones unitarias y E2E.**

Run: `corepack pnpm test && corepack pnpm test:e2e`

Expected: todas las pruebas existentes y nuevas pasan; las rutas protegidas conservan redirección a acceso.

- [ ] **Step 4: Ejecutar los controles finales.**

Run: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`

Expected: cuatro códigos de salida `0`, sin `typescript.ignoreBuildErrors` ni errores de espacios.

- [ ] **Step 5: Confirmar el cierre visual.**

Run: `git add src/app/grupos/page.tsx src/components/groups src/app/perfil/page.tsx src/components/profile tests/unit/groups-content.test.tsx tests/unit/profile-form.test.tsx tests/e2e/public-navigation.spec.ts && git commit -m "feat: unify shared and profile experience"`

Expected: grupos y perfil conservan su comportamiento, con el nuevo lenguaje visual.

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 cubren la fuente de verdad y autorizaciones; Tasks 3–6 cubren dashboard, cuentas, operaciones, detalle de compra, grupos, perfil y validación.
- **Placeholder scan:** cada tarea lista rutas, interfaces, comandos, criterios y efectos observables; OCR, imágenes, WhatsApp y sincronización permanecen fuera de alcance.
- **Type consistency:** `AccountType`, `OperationType`, `PurchaseItemDraft`, `recordPersonalTransaction` y `loadPersonalLedger` se definen en Task 2 antes de que los componentes los consuman.
