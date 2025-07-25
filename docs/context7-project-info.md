# Context7 Project Documentation

## Architecture Overview

### Backend (NestJS)
- **Framework**: NestJS v10.0.0
- **Authentication**: Passport Local Strategy with session management
- **Database**: PostgreSQL via Supabase (cloud-hosted)
- **Caching**: Redis for session storage and data caching
- **Validation**: Zod schemas for request/response validation

### Frontend (Remix)
- **Framework**: Remix with React
- **UI**: Custom components with shadcn/ui
- **Routing**: File-based routing system
- **Integration**: Server-side rendering with NestJS API calls

## Key Components

### Authentication System
- `LocalAuthGuard`: NestJS guard for route protection
- Session management via Redis
- User data cached for performance

### Admin Module
- `AdminStaffController`: CRUD operations for staff management
- `AdminStaffService`: Business logic layer
- PostgreSQL integration via Supabase with `___config_admin` table

### Common Patterns
- Error handling with try/catch and structured responses
- Logging with NestJS Logger
- Zod validation for type safety
- Pagination and filtering for data queries

## Development Context
- Monorepo structure with workspace dependencies
- Docker Compose for Redis development
- TypeScript compilation in watch mode
- Hot reload for both frontend and backend

## Current Focus
- Fixing authentication routing conflicts
- Resolving 403 errors in admin staff endpoints
- Migrating from `/api/staff` to `/admin/staff` routes
