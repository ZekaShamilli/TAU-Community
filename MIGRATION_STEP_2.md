# Migration Step 2: Create Pending Registrations Table

## ⚠️ CRITICAL: Run This SQL in Supabase

Bu SQL'i Supabase SQL Editor'da çalıştır:

```sql
-- Create pending_registrations table for storing signup data before email verification
-- This allows us to only create user accounts AFTER email is verified

CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  verification_code_expires TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_verification_code ON pending_registrations(verification_code);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations(verification_code_expires);

-- Auto-delete expired pending registrations (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_pending_registrations()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_registrations
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE pending_registrations IS 'Temporary storage for user registration data before email verification';
COMMENT ON COLUMN pending_registrations.verification_code_expires IS 'Code expires after 10 minutes';
```

## 📋 Nasıl Çalıştırılır

1. Supabase Dashboard'a git: https://supabase.com/dashboard
2. Projenizi seçin
3. Sol menüden **SQL Editor**'ı açın
4. Yukarıdaki SQL'i yapıştırın
5. **Run** butonuna tıklayın

## ✅ Doğrulama

SQL çalıştıktan sonra kontrol et:

```sql
-- Tablo oluşturuldu mu?
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'pending_registrations';

-- Kolonlar doğru mu?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pending_registrations';
```

## 🔄 Yeni Akış

### Eski Akış (Problem):
1. Signup → **Hesap oluştur** → Email gönder → Verify et → Login
2. ❌ Verify edilmeyen hesaplar database'de kalıyor

### Yeni Akış (Çözüm):
1. Signup → **pending_registrations'a kaydet** → Email gönder
2. Verify → **Hesabı oluştur** → Welcome email → Login
3. ✅ Sadece verify edilmiş hesaplar users tablosunda

## 📊 Değişiklikler

### Backend (api/index.js):

**Signup Endpoint:**
- ❌ Artık users tablosuna kaydetmiyor
- ✅ pending_registrations tablosuna kaydediyor
- ✅ Hemen verification code gönderiyor

**Verify Email Endpoint:**
- ❌ Artık sadece email_verified güncellemesi yapmıyor
- ✅ pending_registrations'dan veriyi alıyor
- ✅ users tablosuna yeni hesap oluşturuyor
- ✅ pending_registrations'dan kaydı siliyor

**Send Verification Code Endpoint:**
- ✅ pending_registrations tablosundan veri alıyor
- ✅ Yeni kod oluşturup gönderiyor

### Otomatik Temizlik:

24 saatten eski pending registrations otomatik silinecek. Bunu manuel çalıştırmak için:

```sql
SELECT cleanup_expired_pending_registrations();
```

## 🧪 Test Adımları

1. **Yeni Signup Test:**
   ```
   - Signup yap
   - users tablosunu kontrol et → Hesap YOK olmalı
   - pending_registrations tablosunu kontrol et → Kayıt VAR olmalı
   ```

2. **Verify Test:**
   ```
   - Kodu doğrula
   - users tablosunu kontrol et → Hesap OLUŞTU
   - pending_registrations tablosunu kontrol et → Kayıt SİLİNDİ
   ```

3. **Expired Code Test:**
   ```
   - Signup yap
   - 10 dakika bekle
   - Verify et → Hata almalısın
   - Resend code yap → Yeni kod gelmeli
   ```

## 🗑️ Eski Verify Edilmemiş Hesapları Temizle

Eğer eski sistemden verify edilmemiş hesaplar varsa:

```sql
-- Önce kontrol et
SELECT email, created_at 
FROM users 
WHERE email_verified = false;

-- Silmek istersen (DİKKATLİ!)
DELETE FROM users WHERE email_verified = false;
```

---

**Migration Tarihi**: 2026-02-08
**Status**: ⏳ Bekliyor - SQL'i çalıştır
