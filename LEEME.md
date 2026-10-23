# De Grupo en Grupo 2026 × Leonora Studio — Reservaciones

## Qué incluye

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página pública: portada, servicios, reservación e información |
| `trabajadoras.html` | Agenda para las trabajadoras (solo nombre, horario y servicio, con código de acceso) |
| `apps-script/Code.gs` | Servidor: guarda en Excel/Google Sheets, controla cupos y envía el correo de confirmación |
| `config.js` | URL del servidor, fecha, lugar y dominios de correo permitidos |
| `data/groups.js` | Lista de grupos (85 opciones: 52 CSE, 29 CGIV, 4 FETEC) |
| `img/` | Logos con fondo transparente |

Mientras `API_URL` en `config.js` esté vacía, el sitio funciona en **modo demo** (las citas se guardan solo en tu navegador y no se envían correos). El código de la vista de trabajadoras en modo demo es `leonora`.

## Puesta en marcha (≈ 10 minutos)

### 1. Crear el Excel y el servidor
1. Crea una hoja nueva en Google Sheets (por ejemplo, "Citas Leonora").
2. Menú **Extensiones → Apps Script**. Borra lo que haya y pega todo el contenido de `apps-script/Code.gs`.
3. En la parte superior de `Code.gs` cambia `STAFF_CODE` (el código que usarán las trabajadoras). Opcional: `REPLY_TO` y `EMAIL_LOGO_URL`.
4. Elige la función `configurar` y presiona **Ejecutar**. Acepta los permisos (hoja de cálculo y envío de correo). Esto crea la hoja "Reservaciones".
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
6. Copia la URL que termina en `/exec`.

### 2. Conectar la página
Abre `config.js` y pega la URL en `API_URL`:
```js
API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

### 3. Publicar la página
Sube la carpeta completa a cualquier hosting estático (Vercel, Netlify, GitHub Pages…). No requiere compilar nada.

### 4. Probar antes de compartir
Haz una reservación con tu correo, revisa que llegue el correo, que aparezca la fila en la hoja y que la vista de trabajadoras muestre el nombre. Luego borra las filas de prueba (deja la fila de encabezados).

## Cómo funciona

- **Horarios:** viernes 13 de noviembre, 12:00 a 16:00 h, bloques de 30 min (12:00 … 15:30).
- **Cupos:** 4 lugares de peinado y 4 de uñas por horario. El servidor revisa el cupo al guardar, así que dos personas no pueden tomar el último lugar al mismo tiempo.
- **Reglas:** una persona (por correo) puede reservar cada servicio una vez y no puede tener dos citas en el mismo horario.
- **Correo institucional:** solo se aceptan `@tec.mx` y `@itesm.mx` (se cambia en `config.js` y en `ALLOWED_DOMAINS` de `Code.gs`).
- **Lista de grupos:** columna A del Excel; si la columna B dice "Sociedad" se marca **CSE**, si dice "Grupo estudiantil" **CGIV**. Comité Ejecutivo, Seprepa, Comité de Participación Estudiantil y Tribunal Estudiantil llevan **FETEC**.
- **Excel:** la hoja "Reservaciones" tiene fecha de registro, fecha, horario, servicio, nombre completo, correo institucional, puesto, grupo, tipo y si el correo se envió. Para descargarla: **Archivo → Descargar → Microsoft Excel (.xlsx)**.
- **Trabajadoras:** el servidor solo les entrega nombre, horario y servicio; correos y grupos nunca llegan a esa página.
- **Lugar:** el correo y la página dicen "Por confirmar". Cuando se defina, cambia `LUGAR` en `config.js` y en `Code.gs`, y vuelve a implementar el script (**Implementar → Administrar implementaciones → editar → Nueva versión**).

## Límites a tener en cuenta
- Con una cuenta de Gmail personal, Apps Script envía hasta 100 correos al día (1,500 con Google Workspace). Para este evento alcanza: máximo 64 citas.
- Si cambias el código de `Code.gs`, hay que publicar una **nueva versión** de la implementación para que surta efecto.

## Fotografía
La portada tiene un espacio para una foto real: guarda una imagen como `img/portada.jpg` y aparecerá automáticamente dentro del arco. Mientras no exista, se muestra un fondo verde bosque con detalles dorados.
