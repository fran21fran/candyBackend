# CandyWeb Backend API

## Overview
Backend API para la plataforma de aprendizaje de idiomas CandyWeb. Este backend funciona en conjunto con un frontend React/Vite desplegado en Vercel.

## Recent Changes
- **2025-09-28**: Configuración inicial del backend en Replit
- **2025-09-28**: Integración con Supabase como base de datos PostgreSQL
- **2025-09-28**: Configuración de deployment para Render
- **2025-09-28**: Configuración del workflow para desarrollo local

## Project Architecture
- **Framework**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL) con Drizzle ORM
- **Authentication**: Express sessions con bcrypt
- **Payments**: MercadoPago integration
- **Email**: SendGrid integration
- **Deployment**: Render (backend) + Vercel (frontend)

### Key Dependencies
- Express.js para el servidor HTTP
- Drizzle ORM para base de datos
- bcrypt para hash de contraseñas
- express-session para manejo de sesiones
- MercadoPago SDK para pagos
- SendGrid para emails

### Database Schema
- **users**: Usuarios registrados con campos para premium
- **game_scores**: Puntuaciones de juegos para leaderboard
- **suggestions**: Sugerencias culturales por idioma
- **suggestion_likes**: Sistema de likes para sugerencias
- **sessions**: Sesiones de usuario (PostgreSQL)

## Development Setup
1. Variables de entorno configuradas en `.env`
2. Base de datos Supabase conectada
3. Servidor corriendo en puerto 8000
4. Migraciones aplicadas con Drizzle

## Deployment Configuration
- **Target**: VM deployment para mantener estado de sesiones
- **Build**: npm install && npm run build
- **Start**: npm start
- **Port**: 8000 (desarrollo), 10000 (producción en Render)

## Frontend Integration
- Frontend desplegado en: https://candyfrontend.vercel.app
- CORS configurado para dominios de Vercel
- API endpoints disponibles en `/api/*`
- Autenticación por cookies de sesión

## Environment Variables
- `DATABASE_URL`: URL de conexión a Supabase
- `SESSION_SECRET`: Clave secreta para sesiones
- `FRONTEND_URL`: URL del frontend en Vercel
- `SENDGRID_API_KEY`: Para envío de emails (opcional)
- `MERCADOPAGO_ACCESS_TOKEN`: Para procesar pagos (opcional)