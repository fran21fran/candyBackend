# CandyWeb Backend API

Backend API para la plataforma de aprendizaje de idiomas CandyWeb.

## 🚀 Deployment en Render

### 1. Preparación

1. Sube este directorio `backend/` a un repositorio Git separado
2. Crea una cuenta en [Render](https://render.com)
3. Configura una base de datos PostgreSQL en [Supabase](https://supabase.com)

### 2. Configuración en Render

1. **Crear nuevo Web Service**:
   - Connect a repository: Selecciona tu repositorio del backend
   - Name: `candyweb-backend`
   - Environment: `Node`
   - Region: `US East (Ohio)` o la más cercana
   - Branch: `main`

2. **Build Settings**:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

3. **Environment Variables** (en Render Dashboard):
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   SESSION_SECRET=your-super-secret-session-key-here
   SENDGRID_API_KEY=your-sendgrid-api-key
   MERCADOPAGO_ACCESS_TOKEN=your-mercadopago-access-token
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   NODE_ENV=production
   PORT=10000
   ```

### 3. Configuración de Base de Datos

1. **En Supabase**:
   - Crea un nuevo proyecto
   - Ve a Settings > Database
   - Copia la connection string (modo pooler para mejor rendimiento)
   - Asegúrate de reemplazar `[YOUR-PASSWORD]` con tu contraseña real

2. **Ejecutar migraciones**:
   ```bash
   npm run db:push
   ```

### 4. Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a Supabase | `postgresql://postgres:...` |
| `SESSION_SECRET` | Clave secreta para sesiones (REQUERIDO en producción) | `your-super-secret-key` |
| `SENDGRID_API_KEY` | API key de SendGrid (opcional) | `SG.xxxxx` |
| `MERCADOPAGO_ACCESS_TOKEN` | Token de MercadoPago | `TEST-xxxxx` o `APP_USR-xxxxx` |
| `FRONTEND_URL` | URL del frontend en Vercel (para CORS) | `https://app.vercel.app` |
| `BACKEND_URL` | URL del backend en Render (para webhooks) | `https://backend.onrender.com` |
| `NODE_ENV` | Entorno de producción | `production` |
| `PORT` | Puerto del servidor | `10000` (Render lo asigna automáticamente) |

## 🔧 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Ejecutar migraciones
npm run db:push

# Modo desarrollo
npm run dev

# Build para producción
npm run build
npm start
```

## 📡 Endpoints API

- `GET /health` - Health check
- `POST /api/register` - Registro de usuario
- `POST /api/login` - Login
- `GET /api/user` - Obtener usuario actual
- `POST /api/logout` - Cerrar sesión
- `POST /api/create-subscription` - Crear suscripción premium
- `POST /api/mercadopago/webhook` - Webhook de MercadoPago
- `POST /api/game-scores` - Guardar puntuación de juego
- `GET /api/user-scores` - Obtener puntuaciones del usuario
- `GET /api/leaderboard/global` - Leaderboard global
- `GET /api/suggestions` - Obtener sugerencias culturales
- `POST /api/suggestions` - Crear sugerencia
- `POST /api/test-email` - Enviar email de prueba

## 🔒 CORS Configuration

El backend está configurado para aceptar requests desde:
- `http://localhost:3000` (desarrollo)
- `http://localhost:5173` (Vite dev server)
- Dominios de Vercel (`.vercel.app`)
- Tu dominio personalizado de frontend

## 🗄️ Base de Datos

### Esquema Principal:
- **users**: Usuarios registrados
- **game_scores**: Puntuaciones de juegos
- **suggestions**: Sugerencias culturales
- **suggestion_likes**: Likes de sugerencias
- **sessions**: Sesiones de usuario (PostgreSQL)

### Migraciones:
```bash
# Generar migración
npm run db:generate

# Aplicar migración
npm run db:migrate

# Push directo (desarrollo)
npm run db:push
```