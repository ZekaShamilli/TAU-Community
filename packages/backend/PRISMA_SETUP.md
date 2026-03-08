# Prisma ORM Setup for TAU Community

This document describes the Prisma ORM setup for the TAU Community system, including database connection management, role-based access control, and seeding.

## Overview

The Prisma setup provides:
- **Role-based database connections** with separate connection pools for different user roles
- **Row-Level Security (RLS) integration** with session context management
- **Database utility functions** for common operations
- **Comprehensive seeding** for development and testing
- **Type-safe database operations** with generated Prisma client

## Files Structure

```
packages/backend/
â”œâ”€â”€ prisma/
â”‚   â””â”€â”€ schema.prisma           # Prisma schema definition
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â””â”€â”€ database.ts         # Database connection manager
â”‚   â”œâ”€â”€ scripts/
â”‚   â”‚   â””â”€â”€ seed.ts            # Database seeding script
â”‚   â””â”€â”€ test/
â”‚       â””â”€â”€ database.test.ts   # Database tests
â””â”€â”€ PRISMA_SETUP.md           # This documentation
```

## Schema Design

### Models

The Prisma schema includes the following models that match the existing PostgreSQL database:

- **User**: System users with role-based access (Super Admin, Club President, Student)
- **Club**: Student clubs with URL slugs and president associations
- **Activity**: Club activities and events with status management
- **Application**: Student applications to join clubs
- **AuditLog**: Comprehensive audit logging for all system actions

### Enums

- **UserRole**: `SUPER_ADMIN`, `CLUB_PRESIDENT`, `STUDENT`
- **ActivityStatus**: `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`
- **ApplicationStatus**: `PENDING`, `APPROVED`, `REJECTED`

## Database Connection Management

### Role-based Connections

The system uses separate database connections for different user roles:

```typescript
// Get role-specific client
const superAdminClient = db.getClient(UserRole.SUPER_ADMIN);
const clubPresidentClient = db.getClient(UserRole.CLUB_PRESIDENT);
const studentClient = db.getClient(UserRole.STUDENT);
```

### Session Context

For Row-Level Security integration:

```typescript
// Execute operation with user context
const result = await db.withContext(userId, userRole, async (client) => {
  return await client.user.findMany();
});
```

### Connection URLs

Configure different database URLs for each role in your `.env` file:

```env
DATABASE_URL="postgresql://tau_kays_user:password@localhost:5432/tau_kays"
DATABASE_URL_SUPER_ADMIN="postgresql://tau_kays_super_admin:password@localhost:5432/tau_kays"
DATABASE_URL_CLUB_PRESIDENT="postgresql://tau_kays_club_president:password@localhost:5432/tau_kays"
DATABASE_URL_STUDENT="postgresql://tau_kays_student:password@localhost:5432/tau_kays"
```

## Database Utilities

The `DatabaseUtils` class provides common operations:

### URL Slug Generation

```typescript
const slug = await DatabaseUtils.generateUrlSlug('TAU Robotics Club');
// Returns: 'tau-robotics-club'
```

### Activity Status Updates

```typescript
const updatedCount = await DatabaseUtils.updateActivityStatuses();
// Automatically marks past activities as completed
```

### Role Checking

```typescript
const isPresident = await DatabaseUtils.isClubPresident(userId, clubId);
const clubId = await DatabaseUtils.getPresidentClubId(userId);
```

### Audit Logging

```typescript
await DatabaseUtils.logAudit({
  userId: 'user-id',
  userRole: UserRole.SUPER_ADMIN,
  action: 'CREATE_CLUB',
  resource: 'clubs',
  resourceId: 'club-id',
  changes: { name: 'New Club' },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  success: true,
});
```

## Database Seeding

### Running Seeds

```bash
# Generate Prisma client
npm run db:generate

# Run seeding script
npm run db:seed
```

### Seed Data

The seeding script creates:
- 1 Super Admin user
- 3 Club President users
- 3 Student users
- 3 Clubs (Robotics, Music, Drama)
- 6 Activities across different clubs
- 4 Applications with different statuses
- Sample audit log entries

### Test Credentials

All seeded users have the password `password123`:

- **Super Admin**: `admin@tau.edu.az`
- **Club Presidents**: 
  - `president.robotics@tau.edu.az`
  - `president.music@tau.edu.az`
  - `president.drama@tau.edu.az`
- **Students**: 
  - `student1@tau.edu.az`
  - `student2@tau.edu.az`
  - `student3@tau.edu.az`

## Testing

### Running Tests

```bash
# Run all database tests
npm test -- src/test/database.test.ts

# Run with coverage
npm run test:coverage
```

### Test Categories

1. **Unit Tests**: Test database manager and utility functions without requiring database connection
2. **Integration Tests**: Test actual database operations (skipped if database unavailable)

### Test Features

- Database connectivity validation
- Role-based client creation
- Session context management
- Schema validation (tables, enums, indexes)
- CRUD operations
- Connection pool management

## Usage Examples

### Basic Operations

```typescript
import { prisma, db, UserRole } from '../lib/database';

// Simple query
const users = await prisma.user.findMany();

// With role-based access
const clubs = await db.withContext(userId, UserRole.CLUB_PRESIDENT, async (client) => {
  return await client.club.findMany({
    where: { presidentId: userId }
  });
});
```

### Creating Records

```typescript
// Create a new club
const club = await prisma.club.create({
  data: {
    name: 'New Club',
    description: 'Club description',
    urlSlug: await DatabaseUtils.generateUrlSlug('New Club'),
    presidentId: userId,
  },
});

// Log the action
await DatabaseUtils.logAudit({
  userId,
  userRole: UserRole.SUPER_ADMIN,
  action: 'CREATE_CLUB',
  resource: 'clubs',
  resourceId: club.id,
  success: true,
});
```

### Complex Queries

```typescript
// Get club with activities and applications
const clubDetails = await prisma.club.findUnique({
  where: { id: clubId },
  include: {
    activities: {
      where: { status: 'PUBLISHED' },
      orderBy: { startDate: 'asc' },
    },
    applications: {
      where: { status: 'PENDING' },
      include: { student: true },
    },
    president: true,
  },
});
```

## Error Handling

The database setup includes comprehensive error handling:

- **Connection failures**: Graceful degradation with health checks
- **Transaction rollbacks**: Automatic cleanup on failures
- **Type safety**: Compile-time validation with TypeScript
- **Constraint violations**: Proper error messages for unique constraints

## Performance Considerations

- **Connection pooling**: Separate pools for different roles
- **Query optimization**: Proper indexes on frequently queried columns
- **Lazy loading**: Clients created only when needed
- **Resource cleanup**: Automatic disconnection on process exit

## Security Features

- **Role-based access**: Separate database users with minimal privileges
- **Row-Level Security**: Integration with PostgreSQL RLS policies
- **Session isolation**: Proper context management for multi-tenant access
- **Audit logging**: Comprehensive tracking of all database operations

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Ensure PostgreSQL is running
   - Check connection URLs in `.env` file
   - Verify database users and permissions

2. **Schema mismatch**
   - Run `npm run db:generate` to regenerate client
   - Check if database schema matches Prisma schema

3. **Permission denied**
   - Verify database user roles and permissions
   - Check RLS policies are properly configured

### Debug Mode

Enable query logging in development:

```env
NODE_ENV=development
```

This will log all SQL queries to the console for debugging.

## Migration Notes

When the database schema changes:

1. Update the Prisma schema file
2. Generate new client: `npm run db:generate`
3. Update seed data if needed
4. Run tests to verify compatibility
5. Update this documentation

## Integration with RLS

The Prisma setup is designed to work seamlessly with the existing Row-Level Security policies:

- Session context is automatically set for each operation
- Role-based connections ensure proper database-level permissions
- Utility functions respect RLS constraints
- Audit logging works within RLS framework

This ensures that the ORM layer maintains the same security guarantees as direct SQL operations.
