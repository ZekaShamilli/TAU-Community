-- Create custom enum types for the TAU KAYS system
-- This script creates the custom types used throughout the database schema

-- User role enumeration
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'CLUB_PRESIDENT', 
    'STUDENT'
);

-- Activity status enumeration
CREATE TYPE activity_status AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CANCELLED',
    'COMPLETED'
);

-- Application status enumeration  
CREATE TYPE application_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

-- Content moderation types
CREATE TYPE content_type AS ENUM (
    'ACTIVITY',
    'CLUB_INFO',
    'APPLICATION',
    'USER_PROFILE'
);

CREATE TYPE moderation_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'FLAGGED',
    'UNDER_REVIEW'
);

CREATE TYPE moderation_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE moderation_action AS ENUM (
    'APPROVE',
    'REJECT',
    'EDIT',
    'DELETE',
    'HIDE',
    'WARN_USER',
    'SUSPEND_USER'
);

CREATE TYPE flag_category AS ENUM (
    'INAPPROPRIATE_CONTENT',
    'SPAM',
    'HARASSMENT',
    'MISINFORMATION',
    'COPYRIGHT_VIOLATION',
    'PRIVACY_VIOLATION',
    'OTHER'
);

CREATE TYPE severity_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE alert_status AS ENUM (
    'OPEN',
    'INVESTIGATING',
    'RESOLVED',
    'FALSE_POSITIVE'
);