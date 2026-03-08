-- TAU Community Platform - Supabase Database Setup
-- Run this script in your Supabase SQL Editor to set up the database schema

-- Create custom types
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'CLUB_PRESIDENT', 'STUDENT');
CREATE TYPE application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE activity_status AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'SUBMIT_APPLICATION', 'CREATE_ACTIVITY', 'UPDATE_ACTIVITY', 'DELETE_ACTIVITY', 'CREATE_CLUB', 'UPDATE_CLUB', 'DELETE_CLUB');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'STUDENT',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clubs table
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    president_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activities table
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255),
    max_participants INTEGER,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status activity_status DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applications table
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status application_status DEFAULT 'PENDING',
    motivation TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(club_id, student_id)
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create password_resets table
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_clubs_president ON clubs(president_id);
CREATE INDEX idx_activities_club ON activities(club_id);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_applications_club ON applications(club_id);
CREATE INDEX idx_applications_student ON applications(student_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'System', 'Administrator', 'SUPER_ADMIN', true),
('22222222-2222-2222-2222-222222222222', 'president.robotics@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'John', 'Smith', 'CLUB_PRESIDENT', true),
('33333333-3333-3333-3333-333333333333', 'president.music@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'Sarah', 'Johnson', 'CLUB_PRESIDENT', true),
('44444444-4444-4444-4444-444444444444', 'president.drama@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'Michael', 'Brown', 'CLUB_PRESIDENT', true),
('55555555-5555-5555-5555-555555555555', 'student1@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'Alice', 'Wilson', 'STUDENT', true),
('66666666-6666-6666-6666-666666666666', 'student2@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'Bob', 'Davis', 'STUDENT', true),
('77777777-7777-7777-7777-777777777777', 'student3@tau.edu.az', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PqhEIe', 'Carol', 'Miller', 'STUDENT', true);

INSERT INTO clubs (id, name, description, president_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TAU Robotics Club', 'A club dedicated to robotics research, competitions, and innovation. We build robots, participate in national competitions, and organize workshops for students interested in robotics and automation.', '22222222-2222-2222-2222-222222222222'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TAU Music Society', 'The official music society of TAU, bringing together musicians of all levels. We organize concerts, jam sessions, and music workshops. Whether you play an instrument or just love music, you are welcome!', '33333333-3333-3333-3333-333333333333'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'TAU Drama Club', 'TAU Drama Club is where creativity meets performance. We produce original plays, organize theater workshops, and participate in inter-university drama festivals. Join us to explore the world of theater!', '44444444-4444-4444-4444-444444444444');

INSERT INTO activities (id, club_id, title, description, start_date, end_date, location, max_participants, created_by, status) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arduino Workshop for Beginners', 'Learn the basics of Arduino programming and electronics. Perfect for beginners who want to start their journey in robotics and embedded systems.', '2026-02-15 14:00:00+00', '2026-02-15 17:00:00+00', 'Engineering Lab 101', 25, '22222222-2222-2222-2222-222222222222', 'PUBLISHED'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'National Robotics Competition Preparation', 'Intensive preparation sessions for the upcoming national robotics competition. Team formation and project planning included.', '2026-02-20 10:00:00+00', '2026-02-20 18:00:00+00', 'Robotics Workshop', 15, '22222222-2222-2222-2222-222222222222', 'PUBLISHED'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Open Mic Night', 'Showcase your musical talents! Open to all students. Bring your instruments or just your voice. A great opportunity to perform and meet fellow musicians.', '2026-02-18 19:00:00+00', '2026-02-18 22:00:00+00', 'Student Center Auditorium', 100, '33333333-3333-3333-3333-333333333333', 'PUBLISHED'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Guitar Workshop Series', 'Learn to play guitar from scratch or improve your existing skills. 4-week intensive course covering basics to intermediate techniques.', '2026-02-25 15:00:00+00', '2026-03-18 17:00:00+00', 'Music Room 205', 20, '33333333-3333-3333-3333-333333333333', 'PUBLISHED'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Improvisation Workshop', 'Develop your acting skills through improvisation exercises. Learn to think on your feet and create compelling characters spontaneously.', '2026-02-22 16:00:00+00', '2026-02-22 19:00:00+00', 'Drama Studio', 30, '44444444-4444-4444-4444-444444444444', 'PUBLISHED'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Spring Play Auditions', 'Auditions for our spring semester play "A Midsummer Night''s Dream". All students welcome, no prior experience required.', '2026-03-01 14:00:00+00', '2026-03-01 18:00:00+00', 'Main Theater', 50, '44444444-4444-4444-4444-444444444444', 'DRAFT');

-- All passwords are 'password123' (hashed with bcrypt)
-- Test credentials:
-- Super Admin: admin@tau.edu.az / password123
-- Club Presidents: president.robotics@tau.edu.az, president.music@tau.edu.az, president.drama@tau.edu.az / password123
-- Students: student1@tau.edu.az, student2@tau.edu.az, student3@tau.edu.az / password123
