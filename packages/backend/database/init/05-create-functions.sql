-- Create utility functions for the TAU KAYS system
-- This script creates helper functions for Row-Level Security and other operations

-- Function to get current user ID from session
-- This function extracts the user ID from the current session context
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
    -- Get user ID from session variable set by application
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user role from session
-- This function extracts the user role from the current session context
CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
BEGIN
    -- Get user role from session variable set by application
    RETURN COALESCE(
        current_setting('app.current_user_role', true)::user_role,
        'STUDENT'::user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a club president for a specific club
CREATE OR REPLACE FUNCTION is_club_president(club_uuid UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM clubs 
        WHERE id = club_uuid 
        AND president_id = current_user_id()
        AND current_user_role() = 'CLUB_PRESIDENT'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get club ID for current club president
CREATE OR REPLACE FUNCTION get_president_club_id() RETURNS UUID AS $$
BEGIN
    IF current_user_role() = 'CLUB_PRESIDENT' THEN
        RETURN (
            SELECT id FROM clubs 
            WHERE president_id = current_user_id() 
            LIMIT 1
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate URL slug from club name
-- Handles Turkish characters and creates URL-friendly slugs
CREATE OR REPLACE FUNCTION generate_url_slug(input_name TEXT) RETURNS TEXT AS $$
DECLARE
    slug TEXT;
    counter INTEGER := 0;
    base_slug TEXT;
    final_slug TEXT;
BEGIN
    -- Convert to lowercase and replace Turkish characters
    slug := lower(input_name);
    slug := replace(slug, 'ç', 'c');
    slug := replace(slug, 'ğ', 'g');
    slug := replace(slug, 'ı', 'i');
    slug := replace(slug, 'ö', 'o');
    slug := replace(slug, 'ş', 's');
    slug := replace(slug, 'ü', 'u');
    
    -- Replace spaces and special characters with hyphens
    slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
    
    -- Remove leading and trailing hyphens
    slug := trim(both '-' from slug);
    
    -- Ensure slug is not empty
    IF slug = '' THEN
        slug := 'club';
    END IF;
    
    base_slug := slug;
    final_slug := base_slug;
    
    -- Handle duplicates by appending numbers
    WHILE EXISTS (SELECT 1 FROM clubs WHERE url_slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update activity status based on dates
CREATE OR REPLACE FUNCTION update_activity_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark activities as completed if end date has passed
    IF NEW.end_date < CURRENT_TIMESTAMP AND NEW.status = 'PUBLISHED' THEN
        NEW.status := 'COMPLETED';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;