# Row-Level Security (RLS) Policies Documentation

## Overview

This document describes the Row-Level Security (RLS) policies implemented for the TAU KAYS system. RLS provides database-level security that automatically filters data based on the current user's role and permissions, ensuring that users can only access data they are authorized to see.

## Architecture

The RLS implementation consists of:

1. **Database Roles**: Three roles corresponding to user types
2. **RLS Policies**: Table-level policies that filter data based on user context
3. **Utility Functions**: Helper functions for role checking and context management
4. **Security Views**: Pre-filtered views for common queries

## Database Roles

### super_admin_role
- **Purpose**: Full system administration
- **Access**: Complete access to all data and operations
- **Use Case**: System administrators who need to manage all clubs and users

### club_president_role
- **Purpose**: Club-specific administration
- **Access**: Limited to their assigned club's data
- **Use Case**: Club presidents who manage their specific club

### student_role
- **Purpose**: Public content access and application submission
- **Access**: Read-only access to public content, can submit applications
- **Use Case**: Students browsing clubs and applying for membership

## RLS Policies by Table

### Users Table

| Role | Policy | Access |
|------|--------|--------|
| Super Admin | `super_admin_users_all` | Full access to all users |
| Club President | `club_president_users_own` | Can read/update own record only |
| Student | `student_users_own` | Can read own record only |

**Security Enforcement:**
- Users can only see their own personal information
- Super Admins can manage all user accounts
- Cross-user data access is prevented

### Clubs Table

| Role | Policy | Access |
|------|--------|--------|
| Super Admin | `super_admin_clubs_all` | Full access to all clubs |
| Club President | `club_president_clubs_own` | Can read/update only assigned clubs |
| Student | `student_clubs_read` | Can read all active clubs |

**Security Enforcement:**
- Club Presidents cannot access other clubs' data
- Students only see active (public) clubs
- Inactive clubs are hidden from students

### Activities Table

| Role | Policy | Access |
|------|--------|--------|
| Super Admin | `super_admin_activities_all` | Full access to all activities |
| Club President | `club_president_activities_own_club` | Can manage activities for their club only |
| Student | `student_activities_read` | Can read published activities from active clubs |

**Security Enforcement:**
- Activities are scoped to specific clubs
- Students only see published activities
- Draft activities are hidden from students

### Applications Table

| Role | Policy | Access |
|------|--------|--------|
| Super Admin | `super_admin_applications_all` | Full access to all applications |
| Club President | `club_president_applications_own_club` | Can read/update applications to their club |
| Student | `student_applications_create` | Can create applications to active clubs |
| Student | `student_applications_own` | Can read their own applications |

**Security Enforcement:**
- Applications are scoped to specific clubs
- Students can only see their own applications
- Club Presidents only see applications to their clubs

### Audit Log Table

| Role | Policy | Access |
|------|--------|--------|
| Super Admin | `super_admin_audit_all` | Full access to all audit logs |
| Club President | `club_president_audit_read` | Can read logs related to their club and own actions |
| Student | `student_audit_own` | Can read their own audit logs only |

**Security Enforcement:**
- Comprehensive audit trail with role-based filtering
- Club Presidents see relevant club activity logs
- Students see only their own activity logs

## Utility Functions

### Core Functions

#### `current_user_id()`
Returns the UUID of the currently authenticated user from session context.

```sql
SELECT current_user_id();
-- Returns: '22222222-2222-2222-2222-222222222222'
```

#### `current_user_role()`
Returns the role of the currently authenticated user.

```sql
SELECT current_user_role();
-- Returns: 'CLUB_PRESIDENT'
```

#### `is_club_president(club_uuid UUID)`
Checks if the current user is the president of a specific club.

```sql
SELECT is_club_president('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Returns: true/false
```

#### `get_president_club_id()`
Returns the club ID for the current club president (null for other roles).

```sql
SELECT get_president_club_id();
-- Returns: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' or NULL
```

### Context Management Functions

#### `set_user_context(user_uuid, user_role, user_email)`
Sets the user context for RLS policies. Must be called when establishing database connections.

```sql
SELECT set_user_context(
    '22222222-2222-2222-2222-222222222222',
    'CLUB_PRESIDENT',
    'president@tau.edu.az'
);
```

#### `clear_user_context()`
Clears the user context and resets database role. Should be called on logout.

```sql
SELECT clear_user_context();
```

### Validation Functions

#### `validate_club_access(club_uuid UUID)`
Validates if the current user has access to a specific club.

```sql
SELECT validate_club_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Returns: true/false based on user role and club ownership
```

#### `get_accessible_clubs()`
Returns table of club IDs accessible to the current user.

```sql
SELECT * FROM get_accessible_clubs();
-- Returns: Table of accessible club UUIDs
```

## Security Views

### accessible_clubs
Pre-filtered view showing only clubs accessible to the current user.

```sql
SELECT * FROM accessible_clubs;
-- Automatically filters based on current user's role
```

### accessible_activities
Pre-filtered view showing only activities accessible to the current user.

```sql
SELECT * FROM accessible_activities;
-- Shows published activities for students, all activities for club presidents of that club
```

## Usage Examples

### Application Connection Setup

```typescript
// When a user logs in, set their context
await db.$executeRaw`
    SELECT set_user_context(
        ${userId}::UUID,
        ${userRole}::user_role,
        ${userEmail}
    )
`;

// Now all queries will be automatically filtered
const clubs = await db.clubs.findMany(); // Only shows accessible clubs
```

### Role-Specific Queries

```typescript
// Super Admin - sees all clubs
const allClubs = await db.clubs.findMany();

// Club President - sees only their clubs
const myClubs = await db.clubs.findMany(); // Automatically filtered

// Student - sees only active clubs
const activeClubs = await db.clubs.findMany(); // Automatically filtered
```

### Safe Data Access

```typescript
// This query is safe - RLS ensures users only see their data
const activities = await db.activities.findMany({
    where: { clubId: requestedClubId }
});
// Club Presidents will only see activities from their clubs
// Students will only see published activities
// Super Admins will see all activities
```

## Security Benefits

### 1. Defense in Depth
- Database-level security as the last line of defense
- Prevents data leaks even if application logic has bugs
- Automatic enforcement without developer intervention

### 2. Simplified Application Logic
- No need to add WHERE clauses for access control
- Reduced risk of forgetting security checks
- Consistent security across all database access

### 3. Audit and Compliance
- All data access is automatically logged
- Role-based access is enforced at the database level
- Meets security compliance requirements

### 4. Performance
- Database-level filtering is highly optimized
- Indexes can be used effectively with RLS policies
- No additional application-level filtering overhead

## Testing

### Unit Tests
Run the TypeScript unit tests to verify RLS logic:

```bash
cd packages/backend
npm test -- rls-policies.test.ts
```

### Integration Tests
Run the SQL integration tests against a live database:

```bash
# Start the database
docker-compose up -d postgres

# Wait for database to be ready, then run tests
cd packages/backend/database/tests
./run-rls-test.sh
```

### Manual Testing
Connect to the database and test policies manually:

```sql
-- Test as Super Admin
SELECT set_user_context('11111111-1111-1111-1111-111111111111', 'SUPER_ADMIN');
SELECT COUNT(*) FROM users; -- Should see all users

-- Test as Club President
SELECT set_user_context('22222222-2222-2222-2222-222222222222', 'CLUB_PRESIDENT');
SELECT COUNT(*) FROM users; -- Should see only own record

-- Test as Student
SELECT set_user_context('44444444-4444-4444-4444-444444444444', 'STUDENT');
SELECT COUNT(*) FROM clubs; -- Should see only active clubs
```

## Troubleshooting

### Common Issues

1. **"No user context" errors**
   - Ensure `set_user_context()` is called after connection
   - Check that session variables are set correctly

2. **Unexpected access denials**
   - Verify the user's role is correct
   - Check that club ownership is properly set
   - Ensure clubs are marked as active for student access

3. **Performance issues**
   - Ensure proper indexes exist on filtered columns
   - Check that RLS policies are using efficient conditions
   - Monitor query execution plans

### Debugging

Enable query logging to see how RLS policies affect queries:

```sql
-- Enable query logging
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- Run your queries and check the PostgreSQL logs
```

## Security Considerations

### 1. Session Management
- Always call `clear_user_context()` on logout
- Implement session timeout mechanisms
- Use connection pooling with proper context isolation

### 2. Role Assignment
- Validate user roles before setting context
- Implement proper authentication before role assignment
- Log all role changes for audit purposes

### 3. Data Integrity
- RLS policies complement but don't replace input validation
- Implement proper business logic validation
- Use database constraints for data integrity

### 4. Monitoring
- Monitor failed access attempts
- Log unusual access patterns
- Implement alerting for security violations

## Maintenance

### Adding New Tables
When adding new tables, ensure you:

1. Enable RLS: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;`
2. Create appropriate policies for each role
3. Grant necessary permissions to roles
4. Update security views if needed
5. Add tests for the new policies

### Modifying Policies
When modifying existing policies:

1. Test changes in a development environment
2. Ensure backward compatibility
3. Update documentation
4. Run full test suite
5. Monitor for unexpected access changes

### Performance Optimization
- Regularly analyze query performance with RLS
- Add indexes on columns used in RLS conditions
- Consider materialized views for complex access patterns
- Monitor database performance metrics

## Conclusion

The RLS implementation provides robust, database-level security for the TAU KAYS system. It ensures that users can only access data appropriate to their role while maintaining good performance and simplifying application development. Regular testing and monitoring ensure the security policies continue to work effectively as the system evolves.
