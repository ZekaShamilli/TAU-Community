-- Content Moderation System Tables
-- This script creates tables for content moderation, flagging, and review mechanisms

-- Content moderation queue table - tracks all content that needs review
CREATE TABLE content_moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type content_type NOT NULL,
    content_id UUID NOT NULL,
    content_data JSONB NOT NULL, -- Snapshot of content at time of flagging
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    status moderation_status DEFAULT 'PENDING',
    priority moderation_priority DEFAULT 'MEDIUM',
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    flagged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    flag_reason TEXT,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_action moderation_action,
    review_comments TEXT,
    auto_flagged BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT content_moderation_flag_reason_length CHECK (flag_reason IS NULL OR length(flag_reason) <= 1000),
    CONSTRAINT content_moderation_review_comments_length CHECK (review_comments IS NULL OR length(review_comments) <= 2000),
    CONSTRAINT content_moderation_review_consistency CHECK (
        (status = 'PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL AND review_action IS NULL) OR
        (status != 'PENDING' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND review_action IS NOT NULL)
    )
);

-- Content flags table - tracks individual flags on content
CREATE TABLE content_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type content_type NOT NULL,
    content_id UUID NOT NULL,
    flagged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    flag_category flag_category NOT NULL,
    flag_reason TEXT NOT NULL,
    additional_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_action moderation_action,
    resolution_comments TEXT,
    
    -- Constraints
    CONSTRAINT content_flags_reason_length CHECK (length(flag_reason) >= 10 AND length(flag_reason) <= 1000),
    CONSTRAINT content_flags_additional_info_length CHECK (additional_info IS NULL OR length(additional_info) <= 2000),
    CONSTRAINT content_flags_resolution_comments_length CHECK (resolution_comments IS NULL OR length(resolution_comments) <= 1000),
    
    -- Prevent duplicate flags from same user for same content
    CONSTRAINT content_flags_unique_user_content UNIQUE (content_type, content_id, flagged_by)
);

-- Content moderation history table - tracks all moderation actions
CREATE TABLE content_moderation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type content_type NOT NULL,
    content_id UUID NOT NULL,
    action moderation_action NOT NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    previous_data JSONB,
    new_data JSONB,
    automated BOOLEAN DEFAULT false,
    
    -- Constraints
    CONSTRAINT content_moderation_history_reason_length CHECK (reason IS NULL OR length(reason) <= 1000)
);

-- Suspicious activity patterns table - tracks patterns for automated detection
CREATE TABLE suspicious_activity_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name VARCHAR(100) NOT NULL,
    pattern_description TEXT,
    detection_rules JSONB NOT NULL,
    severity_level severity_level DEFAULT 'MEDIUM',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT suspicious_patterns_name_length CHECK (length(pattern_name) >= 3 AND length(pattern_name) <= 100),
    CONSTRAINT suspicious_patterns_description_length CHECK (pattern_description IS NULL OR length(pattern_description) <= 1000)
);

-- Suspicious activity alerts table - tracks detected suspicious activities
CREATE TABLE suspicious_activity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES suspicious_activity_patterns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_data JSONB NOT NULL,
    severity_level severity_level NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status alert_status DEFAULT 'OPEN',
    resolution_notes TEXT,
    
    -- Constraints
    CONSTRAINT suspicious_alerts_resolution_notes_length CHECK (resolution_notes IS NULL OR length(resolution_notes) <= 2000)
);

-- Create indexes for performance
CREATE INDEX idx_content_moderation_queue_status ON content_moderation_queue(status);
CREATE INDEX idx_content_moderation_queue_priority ON content_moderation_queue(priority);
CREATE INDEX idx_content_moderation_queue_flagged_at ON content_moderation_queue(flagged_at);
CREATE INDEX idx_content_moderation_queue_content ON content_moderation_queue(content_type, content_id);
CREATE INDEX idx_content_moderation_queue_club ON content_moderation_queue(club_id);

CREATE INDEX idx_content_flags_content ON content_flags(content_type, content_id);
CREATE INDEX idx_content_flags_flagged_by ON content_flags(flagged_by);
CREATE INDEX idx_content_flags_category ON content_flags(flag_category);
CREATE INDEX idx_content_flags_created_at ON content_flags(created_at);

CREATE INDEX idx_content_moderation_history_content ON content_moderation_history(content_type, content_id);
CREATE INDEX idx_content_moderation_history_performed_at ON content_moderation_history(performed_at);
CREATE INDEX idx_content_moderation_history_action ON content_moderation_history(action);

CREATE INDEX idx_suspicious_activity_alerts_user ON suspicious_activity_alerts(user_id);
CREATE INDEX idx_suspicious_activity_alerts_status ON suspicious_activity_alerts(status);
CREATE INDEX idx_suspicious_activity_alerts_severity ON suspicious_activity_alerts(severity_level);
CREATE INDEX idx_suspicious_activity_alerts_detected_at ON suspicious_activity_alerts(detected_at);