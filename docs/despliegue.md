# Despliegue del ambiente de demostración

Cómo está montado el ambiente público de Mira y cómo recrearlo desde cero.
Las decisiones detrás están en [D12 y D13](./decisiones-tecnicas.md).

```
Navegador ──► Vercel (apps/web)  ──/api/*──►  Render (apps/api)  ──►  Supabase (PostgreSQL)
              mismo origen: la cookie de sesión es first-party
```

| Pieza | Servicio | Plan | Configuración versionada |
| --- | --- | --- | --- |
| Frontend | Vercel | Hobby | [`apps/web/vercel.json`](../apps/web/vercel.json) |
| API | Render, región `oregon` | Free | [`render.yaml`](../render.yaml) |
| Base de datos | Supabase, región `us-west-1` | Free | migraciones de Prisma |
| Pinger | UptimeRobot | Free | — |

Las tres apps despliegan **la rama `main`**: la demo siempre corresponde a un
release. Vercel además publica una preview por cada PR (usa la misma API y la
misma base que producción, así que solo sirve para revisar cambios del frontend).

---

## Variables de entorno

| Variable | Dónde | Valor |
| --- | --- | --- |
| `DATABASE_URL` | Render (secreto) | Supabase → Connect → **Transaction pooler** (puerto `6543`) + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Render (secreto) | Supabase → Connect → **Session pooler** (puerto `5432`, host `pooler.supabase.com`) |
| `CORS_ORIGIN` | Render (secreto) | `https://<proyecto>.vercel.app`, exacto, sin `/` final |
| `JWT_SECRET` | Render | lo genera el Blueprint (`generateValue`) |
| `NODE_ENV`, `NODE_VERSION`, `BCRYPT_ROUNDS`, `JWT_EXPIRES_IN` | Render | fijas en `render.yaml` |
| `VITE_API_URL` | Vercel (Production y Preview) | `/api` |

> **`DIRECT_URL` no es la "Direct connection".** La conexión directa de
> Supabase (`db.<ref>.supabase.co`) es solo IPv6 y Render no sale por IPv6:
> `prisma migrate deploy` falla con `P1001 Can't reach database server`.

---

## Recrear el ambiente desde cero

Unos 20 minutos. Hazlo en este orden: cada paso necesita un dato del anterior.

### 1. Supabase

1. New project, región **West US (North California)** (`us-west-1`).
   Guarda la contraseña de la base en tu gestor de contraseñas.
2. Connect → copia la cadena del **Transaction pooler** (→ `DATABASE_URL`) y
   la del **Session pooler** (→ `DIRECT_URL`), reemplazando `[YOUR-PASSWORD]`.
3. Settings → Team: invita al resto del equipo.

### 2. Render

1. New → **Blueprint** → conecta `MiraPdS/mira`. Render lee `render.yaml`.
2. Pega `DATABASE_URL` y `DIRECT_URL` cuando las pida. En `CORS_ORIGIN` pon por
   ahora `https://mira.vercel.app`; se corrige en el paso 4.
3. Espera el primer deploy. En el log del build deben aparecer
   `migrate deploy` (migraciones aplicadas) y el seed sin errores.
4. Anota la URL del servicio. Si no es exactamente
   `https://mira-api.onrender.com` (el nombre estaba tomado), **actualiza el
   `destination` de `apps/web/vercel.json`** en un PR.
5. Comprueba: `https://<servicio>.onrender.com/api/health` →
   `{"status":"ok","db":"ok",...}`.

### 3. Vercel

1. Add New → Project → importa `MiraPdS/mira`.
2. **Root Directory:** `apps/web`. Framework: Vite (lo detecta).
3. Environment Variables: `VITE_API_URL=/api` en Production y Preview.
4. Settings → Git → Production Branch: `main`.
5. Deploy y anota la URL de producción (`https://<proyecto>.vercel.app`).

### 4. Cerrar el círculo

1. En Render, ajusta `CORS_ORIGIN` a la URL exacta de Vercel (redeploy automático).
2. UptimeRobot → New monitor → HTTP(s), URL
   `https://<proyecto>.vercel.app/api/health`, intervalo 10 minutos.
   Mantiene despierta la API y evita que Supabase pause el proyecto tras 7 días
   sin actividad.
3. Pon la URL de producción en la tabla de enlaces del README.

### Desplegar una rama que aún no está en `main`

Para probar antes de un release: en Render, Manual Deploy → *Deploy a specific
commit*; en Vercel, `vercel deploy` desde la rama (queda como preview). No
cambies la rama de producción.

---

## Verificación

- [ ] `https://<proyecto>.vercel.app/api/health` → `200`, `"db":"ok"`.
- [ ] Login con `ada@mira.dev` / `demo1234` en Chrome, Chrome incógnito y Safari.
- [ ] En DevTools, el `Set-Cookie` viene de `vercel.app` con `HttpOnly; Secure`.
- [ ] F5 sobre `/projects/<id>` no da 404; cerrar sesión borra la cookie.
- [ ] El monitor de UptimeRobot está verde.

---

## Cosas que conviene saber

- **Arranque en frío.** Si el pinger se detiene, Render duerme la API tras 15
  minutos sin tráfico y la primera petición tarda 30-60 s (puede llegar a dar
  504 en el rewrite). Antes de una demo, abre `/api/health` un minuto antes.
- **Horas del plan free.** Render da 750 h/mes **por cuenta**; un servicio
  siempre despierto usa ~744 h. No pongas otro servicio free en la misma cuenta.
- **Pausa de Supabase.** Si igual se pausó, se reactiva desde su dashboard
  (Restore project).
- **Credenciales públicas.** Los usuarios del seed (`ada@`, `alan@`,
  `grace@mira.dev`, contraseña `demo1234`) son públicos a propósito: la base
  solo tiene datos de demostración.
- **El seed no resetea.** Corre en cada deploy y recrea lo que se haya borrado,
  pero no revierte ediciones.
- **Migraciones.** Corren en el build. Si fallan, el deploy falla y sigue viva
  la versión anterior. Si una migración se aplicó pero un paso posterior falló,
  la base queda adelantada respecto del código: por eso las migraciones
  destructivas se hacen en dos releases.
- **Nunca apuntes tu `.env` local a Supabase.** `npm run db:reset` borraría la
  demo.
