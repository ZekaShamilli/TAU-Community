-- Seed data for development and testing
-- This script creates initial data for the TAU KAYS system

-- Insert Super Admin user
INSERT INTO users (id, email, password_hash, role, first_name, last_name, totp_enabled) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'SUPER_ADMIN', 'System', 'Administrator', true);

-- Insert Club Presidents
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone) VALUES
('22222222-2222-2222-2222-222222222222', 'president.robotics@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'CLUB_PRESIDENT', 'Ahmet', 'YÄ±lmaz', '+90 532 123 4567'),
('33333333-3333-3333-3333-333333333333', 'president.music@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'CLUB_PRESIDENT', 'Elif', 'Kaya', '+90 532 234 5678'),
('44444444-4444-4444-4444-444444444444', 'president.drama@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'CLUB_PRESIDENT', 'Mehmet', 'Ã–zkan', '+90 532 345 6789');

-- Insert Students
INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES
('55555555-5555-5555-5555-555555555555', 'student1@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'STUDENT', 'AyÅŸe', 'Demir'),
('66666666-6666-6666-6666-666666666666', 'student2@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'STUDENT', 'Can', 'Åžahin'),
('77777777-7777-7777-7777-777777777777', 'student3@tau.edu.az', '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ', 'STUDENT', 'Zeynep', 'Arslan');

-- Insert Clubs
INSERT INTO clubs (id, name, description, president_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TAU Robotics Club', 'A club dedicated to robotics research, competitions, and innovation. We build robots, participate in national competitions, and organize workshops for students interested in robotics and automation.', '22222222-2222-2222-2222-222222222222'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TAU Music Society', 'The official music society of TAU, bringing together musicians of all levels. We organize concerts, jam sessions, and music workshops. Whether you play an instrument or just love music, you are welcome!', '33333333-3333-3333-3333-333333333333'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'TAU Drama Club', 'TAU Drama Club is where creativity meets performance. We produce original plays, organize theater workshops, and participate in inter-university drama festivals. Join us to explore the world of theater!', '44444444-4444-4444-4444-444444444444');

-- Insert Activities
INSERT INTO activities (id, club_id, title, description, start_date, end_date, location, max_participants, created_by, status) VALUES
-- Robotics Club Activities
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arduino Workshop for Beginners', 'Learn the basics of Arduino programming and electronics. This hands-on workshop will cover basic circuits, sensors, and programming concepts. Perfect for beginners!', '2024-02-15 14:00:00', '2024-02-15 17:00:00', 'Engineering Building - Lab 201', 25, '22222222-2222-2222-2222-222222222222', 'PUBLISHED'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'National Robotics Competition Preparation', 'Intensive preparation sessions for the upcoming national robotics competition. Team formation and project planning.', '2024-02-20 10:00:00', '2024-02-20 16:00:00', 'Robotics Lab', 15, '22222222-2222-2222-2222-222222222222', 'PUBLISHED'),

-- Music Society Activities  
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Open Mic Night', 'Monthly open mic night where students can showcase their musical talents. All genres welcome! Bring your instruments or use ours.', '2024-02-18 19:00:00', '2024-02-18 22:00:00', 'Student Center - Main Hall', 100, '33333333-3333-3333-3333-333333333333', 'PUBLISHED'),
('gggggggg-gggg-gggg-gggg-gggggggggggg', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Guitar Workshop Series', 'Weekly guitar workshops covering different techniques and styles. From beginner to advanced levels. Guitars provided for beginners.', '2024-02-22 18:00:00', '2024-02-22 20:00:00', 'Music Room - Building C', 20, '33333333-3333-3333-3333-333333333333', 'PUBLISHED'),

-- Drama Club Activities
('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Improvisation Workshop', 'Learn the art of improvisation! This workshop will help you develop quick thinking, creativity, and confidence on stage.', '2024-02-25 16:00:00', '2024-02-25 18:00:00', 'Drama Studio', 15, '44444444-4444-4444-4444-444444444444', 'PUBLISHED'),
('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Spring Play Auditions', 'Auditions for our spring semester play "The Importance of Being Earnest". All students welcome to audition for various roles.', '2024-03-01 14:00:00', '2024-03-01 18:00:00', 'Main Theater', 50, '44444444-4444-4444-4444-444444444444', 'DRAFT');

-- Insert Applications
INSERT INTO applications (id, club_id, student_id, student_name, student_email, motivation, status, reviewed_by, review_comments) VALUES
-- Approved applications
('jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'AyÅŸe Demir', 'student1@tau.edu.az', 'I have always been fascinated by robotics and automation. I have some experience with programming and would love to learn more about building robots and participating in competitions.', 'APPROVED', '22222222-2222-2222-2222-222222222222', 'Great motivation and background. Welcome to the club!'),

-- Pending applications
('kkkkkkkk-kkkk-kkkk-kkkk-kkkkkkkkkkkk', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'Can Åžahin', 'student2@tau.edu.az', 'Music has been my passion since childhood. I play guitar and piano, and I would love to collaborate with other musicians and perform in concerts.', 'PENDING', NULL, NULL),
('llllllll-llll-llll-llll-llllllllllll', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', 'Zeynep Arslan', 'student3@tau.edu.az', 'I have been interested in theater since high school. I participated in several school plays and would love to continue acting and maybe try directing as well.', 'PENDING', NULL, NULL),

-- Rejected application (example)
('mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'Zeynep Arslan', 'student3@tau.edu.az', 'I want to join because robots are cool.', 'REJECTED', '22222222-2222-2222-2222-222222222222', 'Application lacks sufficient detail and commitment. Please reapply with more specific motivation.');

-- Insert some audit log entries for demonstration
INSERT INTO audit_log (user_id, user_role, action, resource, resource_id, ip_address, user_agent, success) VALUES
('11111111-1111-1111-1111-111111111111', 'SUPER_ADMIN', 'CREATE_CLUB', 'clubs', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', true),
('22222222-2222-2222-2222-222222222222', 'CLUB_PRESIDENT', 'CREATE_ACTIVITY', 'activities', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '192.168.1.101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', true),
('55555555-5555-5555-5555-555555555555', 'STUDENT', 'SUBMIT_APPLICATION', 'applications', 'jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj', '192.168.1.102', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', true);
