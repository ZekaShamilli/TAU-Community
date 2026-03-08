# TAU KAYS Database Schema

This directory contains the complete PostgreSQL database schema for the TAU Club and Activity Management System (KAYS).

## Schema Overview

The database implements a comprehensive role-based access control system with the following main components:

### Tables
- **users**: System users with role-based access (Super Admin, Club President, Student)
- **clubs**: Student clubs with URL slug generation and president assignment
- **activities**: Club activities and events with status management
- **applications**: Student applications to join clubs with approval workflow
- **audit_log**: Comprehensive logging of all system activities

### Custom Types
- **user_role**: ENUM('SUPER_ADMIN', 'CLUB_PRESIDENT', 'STUDENT')
- **activity_status**: ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')
- **application_status**: ENUM('PENDING', 'APPROVED', 'REJECTED')

### Key Features
- **Row-Level Security (RLS)**: Database-level access control based on user roles
- **Automatic URL Slug Generation**: Turkish character support for club URLs
- **Audit Logging**: Complete tracking of all system changes
- **Data Validation**: Comprehensive constraints and business rule enforcement
- **Performance Optimization**: Strategic indexes for common query patterns

## File Structure

```
database/
├── init/                           # Database initialization scripts (auto-executed by Docker)
│   ├── 00-init-database.sql      # Master initialization script
│   ├── 01-create-roles.sql       # Database roles and users
│   ├── 02-create-types.sql       # Custom enum types
│   ├── 03-create-tables.sql      # Main table definitions
│   ├── 04-create-indexes.sql     # Performance indexes
│   ├── 05-create-functions.sql   # Utility functions
│   ├── 06-create-triggers.sql    # Automatic triggers
│   ├── 07-setup-permissions.sql  # Role-based permissions
│   └── 08-seed-data.sql          # Development seed data
├── verify-schema.sql              # Schema verification script
└── README.md                      # This file
```

## Usage

### Starting the Database

The database is configured to run in Docker. Use the following command from the project root:

```bash
docker-compose up -d postgres
```

The initialization scripts in the `init/` directory will be automatically executed in alphabetical order when the container starts for the first time.

### Verifying the Schema

After the database is running, you can verify the schema was created correctly:

```bash
# Connect to the database
docker exec -it tau-kays-postgres psql -U tau_kays_user -d tau_kays

# Run the verification script
\i /docker-entrypoint-initdb.d/verify-schema.sql
```

Or from outside the container:

```bash
psql -h localhost -U tau_kays_user -d tau_kays -f packages/backend/database/verify-schema.sql
```

### Database Roles and Users

The system creates three database roles with appropriate permissions:

1. **super_admin_role**: Full access to all tables and operations
2. **club_president_role**: Limited access to their own club's data
3. **student_role**: Read-only access to public information, can submit applications

Application users are created for each role:
- `tau_kays_super_admin` (password: `super_admin_password`)
- `tau_kays_club_president` (password: `club_president_password`)
- `tau_kays_student` (password: `student_password`)

### Seed Data

The schema includes development seed data:
- 1 Super Admin user
- 3 Club President users
- 3 Student users
- 3 Sample clubs (Robotics, Music, Drama)
- 6 Sample activities
- 4 Sample applications (approved, pending, rejected)
- Sample audit log entries

## Key Constraints and Business Rules

### Users Table
- Email must be valid format and unique
- Names must be 2-100 characters
- Phone number format validation
- TOTP secret for 2FA support

### Clubs Table
- Name must be 3-200 characters and unique
- URL slug automatically generated from name with Turkish character support
- Description limited to 2000 characters
- Must have an assigned president

### Activities Table
- Title must be 5-300 characters
- End date must be after start date
- Start date should be in the future (with 1-day flexibility for editing)
- Automatic status updates based on dates

### Applications Table
- Motivation must be 50-1000 characters
- Unique constraint prevents duplicate applications per student per club
- Automatic timestamp management for review process
- Review consistency constraints

### Audit Log Table
- Comprehensive logging of all user actions
- IP address and user agent tracking
- JSON storage for change details
- Success/failure tracking with error messages

## Functions and Triggers

### Utility Functions
- `current_user_id()`: Get current user ID from session
- `current_user_role()`: Get current user role from session
- `is_club_president(club_uuid)`: Check if user is president of specific club
- `get_president_club_id()`: Get club ID for current president
- `generate_url_slug(input_name)`: Generate URL-friendly slug with Turkish support

### Automatic Triggers
- **Updated At Timestamps**: Automatically update `updated_at` on record changes
- **URL Slug Generation**: Auto-generate club URL slugs from names
- **Activity Status Updates**: Mark activities as completed when end date passes
- **Application Review Timestamps**: Set review timestamps when status changes

## Performance Considerations

The schema includes strategic indexes for:
- User lookups by email and role
- Club lookups by name and URL slug
- Activity queries by club and date ranges
- Application queries by club and status
- Audit log queries by user, resource, and timestamp

## Security Features

- **Row-Level Security**: Database-level access control
- **Role-Based Permissions**: Minimal required privileges for each role
- **Input Validation**: Comprehensive constraint checking
- **Audit Trail**: Complete logging of all system activities
- **Password Security**: Bcrypt hashing for all passwords
- **2FA Support**: TOTP secret storage for Super Admins

## Maintenance

### Regular Tasks
- Monitor audit log growth and archive old entries
- Update activity statuses (handled automatically by triggers)
- Clean up expired sessions and tokens
- Review and optimize query performance

### Backup Strategy
- Regular database backups using `pg_dump`
- Point-in-time recovery configuration
- Test restore procedures regularly

## Troubleshooting

### Common Issues
1. **Permission Denied**: Ensure correct database role is being used
2. **Constraint Violations**: Check input data against constraint definitions
3. **Slug Conflicts**: URL slug generation handles duplicates automatically
4. **Performance Issues**: Check query plans and index usage

### Debugging Queries
```sql
-- Check current user context
SELECT current_user_id(), current_user_role();

-- View constraint violations
SELECT * FROM pg_constraint WHERE NOT convalidated;

-- Monitor query performance
EXPLAIN ANALYZE SELECT ...;
```

For additional support, refer to the main project documentation or contact the development team.