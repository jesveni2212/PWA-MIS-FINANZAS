# Diseno - importes localizados y navegacion activa

**Fecha:** 2026-09-09  
**Estado:** pendiente de revision del usuario antes de planificar

## 1. Contexto

Los formularios de cuentas, movimientos y detalle de compras usan entradas
numericas nativas. El navegador muestra `500000` sin separadores, aunque la
aplicacion esta orientada a usuarios de Paraguay y el formato esperado es
`500.000` o `50.000,25`.

El `AppShell` comparte el menu principal entre escritorio y movil, pero sus
enlaces no indican cual corresponde a la ruta visible. El mismo cambio debe
mejorar la orientacion sin duplicar menus ni alterar su contenido.

## 2. Objetivo y limites

El objetivo es:

1. mostrar los tres importes monetarios con formato local mientras se editan;
2. conservar valores numericos exactos para calculos y guardado;
3. destacar la opcion principal activa en sidebar y menu movil.

Queda fuera de alcance:

- cambiar tablas, migraciones, monedas disponibles o reglas de negocio;
- agregar simbolos de moneda dentro de los inputs;
- formatear la cantidad de los items de compra, que no es un importe;
- cambiar el texto, el orden o los destinos de la navegacion;
- agregar badges textuales que ocupen espacio en el menu movil.

## 3. Experiencia propuesta

### 3.1 Importes

Los siguientes campos usaran el mismo `MoneyInput`:

- `Saldo inicial` o `Deuda inicial` de `AccountForm`;
- `Importe` de `OperationForm`;
- `Precio unitario` de `PurchaseItemEditor`.

El input sera visualmente de texto con teclado decimal en dispositivos moviles.
El formateo sera visible durante la edicion y preservara el cursor tanto como
sea posible:

- `500000` se muestra como `500.000`;
- `50000,25` se muestra como `50.000,25`;
- el punto representa agrupacion de miles y la coma representa decimales;
- se conservaran los decimales escritos, sin redondear ni agregar simbolos de
  moneda;
- se aceptara tambien un decimal con punto cuando sea inequivo por
  compatibilidad con valores escritos con el input numerico anterior, pero la
  visualizacion se normalizara al formato local.

El componente emitira un string decimal canonico para los formularios, usando
punto como separador interno: `500.000` produce `500000` y `50.000,25` produce
`50000.25`. Los formularios seguiran convirtiendo ese valor con `Number` antes
de validar o persistir. Un campo vacio podra permanecer vacio mientras se
edita; las validaciones actuales decidiran si el envio es valido.

## 4. Navegacion activa

`AppShell` obtendra el pathname actual con `usePathname` y usara un helper puro
para comparar cada opcion:

- `Inicio` solo sera activa en `/`;
- las demas opciones seran activas en su ruta exacta y en rutas hijas;
- los query params no cambiaran la opcion activa, por lo que
  `/movimientos?tipo=expense` marcara `Movimientos`.

El enlace activo tendra un fondo de acento suave, texto e icono destacados y
un borde/acento visual. El enlace incluira `aria-current="page"`; los enlaces
no activos no tendran ese atributo. Como el mismo listado se presenta en
desktop y movil, ambas variantes recibiran el mismo estado sin duplicacion de
logica. Se conservaran los estilos de foco, hover, targets tactiles y destinos
actuales.

## 5. Diseno tecnico

### Componente de importe

Crear `MoneyInput` en `src/components/ui/` junto con helpers puros de
normalizacion y formateo si el componente los necesita. La interfaz recibira
un valor canonico, un callback `onChange`, las props normales del input y el
label seguira perteneciendo al formulario consumidor.

El componente:

- filtrara caracteres no numericos de forma controlada;
- normalizara agrupadores y separador decimal;
- evitara enviar `NaN`, simbolos de moneda o texto formateado al dominio;
- mantendra `id`, `min`, `step`, `required` y atributos de accesibilidad que
  los formularios ya usan;
- no tocara la logica de Supabase ni las funciones de calculo.

### Estado activo

Agregar una comparacion reutilizable para rutas de navegacion y aplicar clases
condicionales al `Link` existente. La ruta se obtiene solo en el shell cliente;
no se agregara estado global ni una segunda fuente de verdad.

## 6. Verificacion

- Pruebas unitarias del formateador/parser: enteros, miles, decimales con coma,
  decimal con punto compatible, vacio y caracteres invalidos.
- Pruebas del `MoneyInput`: valor visible localizado y valor canonico emitido.
- Pruebas de `AccountForm`, `OperationForm` y `PurchaseItemEditor` para
  confirmar que se persisten los numeros correctos.
- Pruebas de `AppShell` para ruta raiz, rutas hijas, query params y
  `aria-current` en el enlace activo.
- Ejecutar al final, en una sola tanda, `corepack pnpm test --pool=forks
  --maxWorkers=1`, `corepack pnpm typecheck`, `corepack pnpm lint` y
  `corepack pnpm build`.

## 7. Criterios de aceptacion

1. Los tres campos muestran `500.000` en lugar de `500000`.
2. Los importes con decimales muestran `50.000,25` y conservan el valor
   numerico `50000.25` al guardar.
3. Las validaciones y calculos existentes siguen recibiendo numeros, no texto
   con separadores.
4. La cantidad de items no cambia de comportamiento.
5. En escritorio y movil, la opcion correspondiente a la ruta actual queda
   visualmente destacada y expone `aria-current="page"`.
6. Query params y rutas hijas mantienen activa la opcion principal correcta.
7. La suite, typecheck, lint y build pasan sin cambios de base de datos,
   secretos ni configuracion externa.
