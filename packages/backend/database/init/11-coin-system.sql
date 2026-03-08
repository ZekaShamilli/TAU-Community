-- Coin System Tables

-- User coins balance table
CREATE TABLE IF NOT EXISTS user_coins (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Coin transactions history
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('AWARD', 'BONUS', 'PENALTY', 'TRANSFER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_coins_balance ON user_coins(balance DESC);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_to_user ON coin_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_from_user ON coin_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_club ON coin_transactions(club_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON coin_transactions(created_at DESC);

-- Function to update user coins
CREATE OR REPLACE FUNCTION update_user_coins()
RETURNS TRIGGER AS $$
BEGIN
    -- Initialize user_coins if not exists
    INSERT INTO user_coins (user_id, balance, total_earned, total_spent)
    VALUES (NEW.to_user_id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Update recipient's balance and total_earned
    UPDATE user_coins
    SET 
        balance = balance + NEW.amount,
        total_earned = total_earned + NEW.amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.to_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update user coins on transaction
CREATE TRIGGER trigger_update_user_coins
AFTER INSERT ON coin_transactions
FOR EACH ROW
EXECUTE FUNCTION update_user_coins();

-- Function to get user's coin balance
CREATE OR REPLACE FUNCTION get_user_coin_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT balance INTO v_balance
    FROM user_coins
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Initialize coins for existing users
INSERT INTO user_coins (user_id, balance, total_earned, total_spent)
SELECT id, 0, 0, 0
FROM users
ON CONFLICT (user_id) DO NOTHING;
