-- Create triggers for the TAU Community system
-- This script creates triggers for automatic timestamp updates and business logic

-- Trigger to automatically update updated_at timestamp on users table
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at timestamp on clubs table
CREATE TRIGGER trigger_clubs_updated_at
    BEFORE UPDATE ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at timestamp on activities table
CREATE TRIGGER trigger_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically generate URL slug when club name changes
CREATE OR REPLACE FUNCTION auto_generate_club_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate slug if it's not provided or if name changed
    IF NEW.url_slug IS NULL OR NEW.url_slug = '' OR 
       (TG_OP = 'UPDATE' AND OLD.name != NEW.name) THEN
        NEW.url_slug := generate_url_slug(NEW.name);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clubs_auto_slug
    BEFORE INSERT OR UPDATE ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_club_slug();

-- Trigger to automatically update activity status based on dates
CREATE TRIGGER trigger_activities_status_update
    BEFORE INSERT OR UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_status();

-- Trigger to set reviewed_at timestamp when application status changes
CREATE OR REPLACE FUNCTION set_application_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Set reviewed_at when status changes from PENDING
    IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status != 'PENDING' THEN
        NEW.reviewed_at := CURRENT_TIMESTAMP;
    END IF;
    
    -- Clear reviewed_at if status changes back to PENDING
    IF TG_OP = 'UPDATE' AND NEW.status = 'PENDING' THEN
        NEW.reviewed_at := NULL;
        NEW.reviewed_by := NULL;
        NEW.review_comments := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_applications_review_timestamp
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION set_application_review_timestamp();