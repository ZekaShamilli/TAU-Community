-- Create all tables for the TAU Community system
-- This script creates the main database tables with proper constraints and relationships

-- Users table - stores all system users with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    totp_secret VARCHAR(32), -- For 2FA (Two-Factor Authentication)
    totp_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_first_name_length CHECK (length(first_name) >= 2 AND length(first_name) <= 100),
    CONSTRAINT users_last_name_length CHECK (length(last_name) >= 2 AND length(last_name) <= 100),
    CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~* '^\+?[0-9\s\-\(\)]{10,20}$')
);

-- Clubs table - stores club information with URL slug generation
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    url_slug VARCHAR(200) UNIQUE NOT NULL,
    president_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT clubs_name_length CHECK (length(name) >= 3 AND length(name) <= 200),
    CONSTRAINT clubs_description_length CHECK (description IS NULL OR length(description) <= 2000),
    CONSTRAINT clubs_url_slug_format CHECK (url_slug ~* '^[a-z0-9\-]+$'),
    CONSTRAINT clubs_url_slug_length CHECK (length(url_slug) >= 3 AND length(url_slug) <= 200)
);

-- Activities table - stores club activities and events
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    location VARCHAR(200),
    max_participants INTEGER,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status activity_status DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT activities_title_length CHECK (length(title) >= 5 AND length(title) <= 300),
    CONSTRAINT activities_description_length CHECK (description IS NULL OR length(description) <= 5000),
    CONSTRAINT activities_location_length CHECK (location IS NULL OR length(location) <= 200),
    CONSTRAINT activities_date_order CHECK (end_date > start_date),
    CONSTRAINT activities_future_start CHECK (start_date > CURRENT_TIMESTAMP - INTERVAL '1 day'), -- Allow some flexibility for editing
    CONSTRAINT activities_max_participants_positive CHECK (max_participants IS NULL OR max_participants > 0)
);

-- Applications table - stores student applications to join clubs
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Allow null if user is deleted
    student_name VARCHAR(200) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    motivation TEXT NOT NULL,
    status application_status DEFAULT 'PENDING',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_comments TEXT,
    
    -- Constraints
    CONSTRAINT applications_student_name_length CHECK (length(student_name) >= 2 AND length(student_name) <= 200),
    CONSTRAINT applications_student_email_format CHECK (student_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT applications_motivation_length CHECK (length(motivation) >= 50 AND length(motivation) <= 1000),
    CONSTRAINT applications_review_comments_length CHECK (review_comments IS NULL OR length(review_comments) <= 1000),
    CONSTRAINT applications_reviewed_consistency CHECK (
        (status = 'PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR
        (status != 'PENDING' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    ),
    
    -- Unique constraint to prevent duplicate applications
    CONSTRAINT applications_unique_student_club UNIQUE (club_id, student_email)
);

-- Audit log table - comprehensive logging of all system activities
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_role user_role NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Constraints
    CONSTRAINT audit_log_action_length CHECK (length(action) >= 1 AND length(action) <= 100),
    CONSTRAINT audit_log_resource_length CHECK (length(resource) >= 1 AND length(resource) <= 100),
    CONSTRAINT audit_log_error_consistency CHECK (
        (success = true AND error_message IS NULL) OR
        (success = false AND error_message IS NOT NULL)
    )
);