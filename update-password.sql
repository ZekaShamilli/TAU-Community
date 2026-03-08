-- Update password for zekashamilli17@gmail.com
UPDATE users 
SET password_hash = 'QXNkYXNhZGFzMTIz'
WHERE email = 'zekashamilli17@gmail.com';

-- Verify the update
SELECT email, password_hash, first_name, last_name, role 
FROM users 
WHERE email = 'zekashamilli17@gmail.com';
