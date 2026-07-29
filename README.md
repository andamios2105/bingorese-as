# 🎯 Bingo de Reseñas — Programa de Referidos Gamificado (v2: tableros compartidos)

Web-app responsiva (mobile-first) para gestionar un programa de empleados/promotores que
ganan una comisión llenando **tableros compartidos** de 100 casillas a punta de reseñas
verificadas en Google Maps. Las casillas nunca se venden — son gratis, se "cambian" por
reseñas reales de clientes.

**Stack:** Next.js 14 (App Router, TypeScript) + Tailwind CSS + Supabase (Postgres + Auth + RLS + Storage).

---

## 1. Arquitectura general

```
Cliente (React/Next.js)
   │  fetch() / supabase-js (respeta sesión del usuario)
   ▼
Route Handlers (src/app/api/**)          ← capa delgada, solo traduce errores
   │  supabase.rpc(...)
   ▼
Funciones SQL SECURITY DEFINER            ← ÚNICA vía de escritura de negocio
   │
   ▼
PostgreSQL (Supabase) con RLS + UNIQUE constraints
```

**Decisión de diseño clave:** ningún cliente (ni siquiera el panel admin) escribe
directamente en las tablas de negocio. Todas las mutaciones pasan por funciones de
Postgres marcadas `SECURITY DEFINER` (`submit_review`, `admin_approve_review`,
`admin_create_table`, `admin_grant_table_access`, `request_payout`,
`admin_approve_payout`, etc.). Esto es lo que hace que las reglas anti-fraude sean
imposibles de saltarse manipulando el frontend o llamando la API directamente con curl:
la autoridad vive en la base de datos, no en el código de React.

---

## 2. El modelo v2: tableros compartidos

A diferencia de un "cartón personal" por promotor, en v2:

- El **admin crea tableros** (`bingo_tables`) de 100 casillas — ej. "Tabla Enero 2026".
- El **admin le da acceso** a empleados específicos (`table_access`) — una relación
  muchos-a-muchos: un empleado puede tener acceso a varios tableros, y un tablero puede
  tener varios empleados.
- Dentro de un tablero, **las 100 casillas son un recurso compartido**: si el empleado A
  reclama la casilla #23, ningún otro empleado con acceso a ese mismo tablero puede
  tomarla — está garantizado por un **índice UNIQUE parcial** en Postgres
  (`reviews_log(table_id, cell_number) WHERE status IN ('pending','verified')`), no solo
  por lógica de aplicación, así que ni una condición de carrera (dos empleados haciendo
  clic en el mismo número al mismo tiempo) puede duplicar una casilla.
- El **progreso hacia el pago (10/30/50/70/100)** es un contador **personal por
  empleado** (`promoter_progress`), acumulado entre **todos** los tableros en los que
  participa. Se resetea a 0 solo para ese empleado cuando le aprueban un pago — el
  tablero compartido nunca se resetea, sigue existiendo con sus casillas ya reclamadas.
- Cuando un tablero llega a 100/100 casillas reclamadas, se marca automáticamente
  `status = 'full'` y deja de aceptar nuevas casillas. El admin crea uno nuevo
  manualmente cuando quiera arrancar otra ronda.

---

## 3. Esquema de base de datos

Ver [`supabase/schema.sql`](supabase/schema.sql) — contiene:

| Tabla | Propósito | Restricción clave |
|---|---|---|
| `profiles` | Datos del empleado/admin (extiende `auth.users`) | `email` UNIQUE |
| `bingo_tables` | Tablero compartido de 100 casillas | `status` en `active/full/archived` |
| `table_access` | Qué empleados pueden reclamar casillas en qué tablero | PK compuesta `(table_id, promoter_id)` |
| `promoter_progress` | Contador personal de cada empleado hacia su próximo pago | 1 fila por empleado |
| `google_reviewers_registry` | Historial de nombres de perfil usados (solo auditoría, no bloquea) | índice por `google_handle` |
| `reviews_log` | Cada casilla reclamada, con su captura de pantalla | UNIQUE parcial `(table_id, cell_number)` mientras esté `pending`/`verified` |
| `payout_requests` | Solicitudes/histórico de cobro por empleado | `UNIQUE(promoter_id, cycle_number, milestone)` |
| `app_settings` | Link fijo del negocio en Google Maps (una sola fila) | usado por el admin para verificar |

### Por qué `google_reviewers_registry` ya no bloquea nombres repetidos

Al principio el nombre normalizado del perfil de Google era único globalmente (un
"candado" anti-duplicados). En la práctica hay mucha gente que comparte el mismo
nombre y eso generaba rechazos falsos de reseñas legítimas. El nombre **no es un
identificador confiable**, así que se quitó el `UNIQUE` y el bloqueo automático: la
tabla ahora es solo un historial de qué nombre se usó en cada reseña, útil como
referencia para el admin. El anti-fraude real sigue siendo la verificación manual del
admin (comparar la captura de pantalla contra el listado de Google Maps con Ctrl+F).

- Al **enviar** una reseña → se guarda el nombre en el historial (no reserva nada).
- Al **rechazar** → la fila se **borra** del historial (la casilla se libera igual).

### Instalación

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** → pega el contenido completo de `supabase/schema.sql` → Run. El
   script es seguro de re-ejecutar: al principio dropea los objetos que cambiaron de
   estructura antes de recrearlos.
3. En **Authentication → Providers → Email**, deja Email/Password habilitado. Para
   pruebas locales rápidas, puedes desactivar "Confirm email" (si lo dejas activo, el
   link de confirmación usa la ruta `/auth/confirm` que ya está implementada en
   `src/app/auth/confirm/route.ts`).
4. Copia `.env.example` a `.env.local` y completa con los valores de
   **Project Settings → API** (Project URL + anon/publishable key).
5. Regístrate normalmente desde `/register` (esto crea el `profile` + `promoter_progress`
   vía el trigger `handle_new_user`), y luego en el SQL Editor vuélvete admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'tu-admin@correo.com';
   ```
6. Como admin, ve a `/admin/tables`, crea tu primer tablero, y dale acceso a los correos
   de tus empleados.

---

## 4. API / Backend — Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| — | Auth (`supabase.auth.signUp` / `signInWithPassword`) | Público | Registro/login vía SDK de Supabase |
| `POST` | `/api/reviews` | Empleado | Reclama una casilla (`tableId`, `cellNumber`, `googleProfileName`, `screenshotUrl`) → `submit_review()` |
| `POST` | `/api/payouts/request` | Empleado | Solicita cobro del hito actual → `request_payout()` |
| `POST` | `/api/admin/tables` | Admin | Crea un tablero (`name`) → `admin_create_table()` |
| `POST` | `/api/admin/tables/[id]/access` | Admin | Da acceso a un empleado (`promoterEmail`) → `admin_grant_table_access()` |
| `DELETE` | `/api/admin/tables/[id]/access` | Admin | Quita acceso (`promoterId`) → `admin_revoke_table_access()` |
| `POST` | `/api/admin/reviews/[id]/approve` | Admin | Aprueba reseña → `admin_approve_review()` |
| `POST` | `/api/admin/reviews/[id]/reject` | Admin | Rechaza reseña (`reason`) → `admin_reject_review()` |
| `POST` | `/api/admin/payouts/[id]/approve` | Admin | Aprueba pago **y resetea el progreso del empleado** → `admin_approve_payout()` |
| `POST` | `/api/admin/payouts/[id]/reject` | Admin | Rechaza solicitud de cobro → `admin_reject_payout()` |
| `POST` | `/api/admin/settings` | Admin | Fija el link del negocio en Google Maps → `admin_update_app_settings()` |

El rol (`promoter` vs `admin`) **no** se valida en el Route Handler — se valida dentro
de cada función SQL. Así, aunque alguien descubra la URL de un endpoint de admin, la
base de datos rechaza la operación si su usuario no tiene el rol correcto.

**Subida de capturas de pantalla:** el navegador sube el archivo directamente a Supabase
Storage (bucket `review-screenshots`, público de solo-URL-no-adivinable) usando
`supabase.storage.from(...).upload(...)` desde `ReviewModal.tsx` — el Route Handler
nunca ve el binario de la imagen, solo recibe la URL resultante.

---

## 5. Frontend

**Lado del empleado:**
- [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx): progreso personal (barra +
  botón de cobro), método de pago, lista de tableros a los que tiene acceso, y sus
  últimas reseñas con estado.
- [`src/app/dashboard/tables/[id]/page.tsx`](src/app/dashboard/tables/[id]/page.tsx) +
  [`ClaimableBingoGrid.tsx`](src/components/ClaimableBingoGrid.tsx): el tablero
  compartido — casillas vacías son clicables (abren `ReviewModal` pre-cargado con ese
  número), casillas tomadas muestran quién las reclamó (tooltip) y su estado
  (naranja=pendiente, verde=verificada). El color se lee de la vista `table_grid_view`.
- [`ReviewModal.tsx`](src/components/ReviewModal.tsx): nombre del perfil de Google +
  subida de captura de pantalla (sin pedir ningún link).
- [`ClaimPayoutButton.tsx`](src/components/ClaimPayoutButton.tsx): solo se habilita
  cuando el progreso personal es exactamente 10/30/50/70/100.

**Lado del admin** ([`src/app/admin/**`](src/app/admin)):
- **Resumen**: contadores rápidos.
- **Tableros** (`/admin/tables`): crear tableros, ver cuántas casillas lleva cada uno, y
  entrar a cada uno para dar/quitar acceso a empleados por correo y ver su grid.
- **Verificar reseñas** (`/admin/reviews`): incluye el campo editable del link fijo del
  negocio en Google Maps, y por cada reseña pendiente muestra la captura subida para
  comparar contra el listado real (Ctrl+F por el nombre).
- **Cobros pendientes** (`/admin/payouts`): desglose por empleado, hito, monto y cuántas
  reseñas verificadas lo justifican en ese ciclo.
- **Auditoría** (`/admin/audit`): buscador global de perfiles de Google ya registrados +
  historial de pagos aprobados + reseñas rechazadas recientes.

---

## 6. Lógica anti-fraude — paso a paso

**Un empleado reclama una casilla.**

1. El cliente sube la captura a Supabase Storage y llama
   `POST /api/reviews` con `{ tableId, cellNumber, googleProfileName, screenshotUrl }`.
2. `submit_review()` corre en una sola transacción:
   a. Bloquea la fila del tablero (`for update`) y verifica que esté `active`.
   b. Verifica que el empleado tenga acceso a ese tablero (`table_access`).
   c. **Normaliza** el nombre de Google (minúsculas, sin acentos ni símbolos) solo para
      guardarlo en `google_reviewers_registry` como historial — no bloquea nada, porque
      el nombre no es un identificador confiable (mucha gente comparte nombre).
   d. Verifica que la casilla no esté ya tomada (`pending`/`verified`) en ese tablero —
      respaldado por el índice `UNIQUE` parcial, así que ni una condición de carrera
      puede colar un duplicado (el segundo `insert` simplemente falla y se traduce a
      *"Esa casilla ya fue reclamada por otro empleado. Elige otra."*).
   e. Inserta en `reviews_log` (`pending`) y guarda el nombre en el historial.
   f. Si esa era la casilla #100 del tablero, lo marca `full` automáticamente.

**El admin rechaza una reseña.** `admin_reject_review()` marca `rejected` (con motivo,
conservado para auditoría) y **borra** la fila del historial — la casilla queda libre
de nuevo para cualquier empleado, y si el tablero estaba `full` vuelve a `active`.

**El admin aprueba una reseña.** `admin_approve_review()` marca `verified`, suma 1 al
`promoter_progress` de ESE empleado (creándolo si es su primera reseña), y deja el
historial como `verified` para referencia futura.

**Un empleado reclama su pago.** `request_payout()` valida en SQL que su
`verified_count` sea *exactamente* uno de `{10,30,50,70,100}`, que no tenga ya una
solicitud pendiente en ese ciclo, y que tenga método de pago configurado.

**El admin aprueba el pago.** `admin_approve_payout()` marca `approved` (queda como
historial financiero permanente) y **resetea solo el progreso de ese empleado**
(`verified_count = 0`, `cycle_number += 1`) — los tableros compartidos y las reseñas de
otros empleados no se tocan para nada.

**Row Level Security (defensa en profundidad):** todas las tablas tienen RLS con
políticas que solo permiten `SELECT` de las propias filas (o todas, si `is_admin()`). El
tablero compartido usa la vista `table_grid_view`, que expone únicamente
`table_id/cell_number/status/promoter_name` (nunca el nombre de Google ni la captura de
otros empleados) a quien tenga acceso a ese tablero. Ninguna tabla acepta `INSERT`/
`UPDATE` directo desde el cliente — todo pasa por las funciones `SECURITY DEFINER`.

---

## 7. Ejecutar en local

```bash
npm install
cp .env.example .env.local   # completa con tus credenciales de Supabase
npm run dev
```

Abre `http://localhost:3000` — te redirige a `/login`.

## 8. Nota de seguridad de dependencias

Este proyecto fija `next@14.2.35` (última versión estable de la rama 14.x). Quedan dos
advisories sin parche en 14.x que solo requieren Next 15/16 para resolverse del todo:
SSRF en `rewrites()`/`redirects()` con hostname dinámico (no aplica, no se usan) y
exposición de endpoints de Server Actions (no aplica, este proyecto usa Route Handlers).
