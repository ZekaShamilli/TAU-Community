-- Önce users tablosuna club_id kolonu ekle (eğer yoksa)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_users_club_id ON users(club_id);

-- Kulübü silinmiş olan başkanları STUDENT rolüne çevir ve club_id'lerini temizle
UPDATE users 
SET 
  role = 'STUDENT',
  club_id = NULL,
  updated_at = CURRENT_TIMESTAMP
WHERE 
  role = 'CLUB_PRESIDENT' 
  AND (
    club_id IS NULL 
    OR club_id NOT IN (SELECT id FROM clubs WHERE is_active = true)
  );

-- Mevcut başkanların club_id'lerini güncelle (eğer NULL ise)
UPDATE users u
SET 
  club_id = c.id,
  updated_at = CURRENT_TIMESTAMP
FROM clubs c
WHERE 
  u.role = 'CLUB_PRESIDENT'
  AND c.president_id = u.id
  AND c.is_active = true
  AND u.club_id IS NULL;

-- Sonuçları kontrol et
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.club_id,
  c.name as club_name,
  c.is_active as club_active
FROM users u
LEFT JOIN clubs c ON u.club_id = c.id
WHERE u.role = 'CLUB_PRESIDENT'
ORDER BY u.created_at DESC;
