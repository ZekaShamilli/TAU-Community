# OTP Email Verification - Test Guide

## ✅ Database Migration Tamamlandı!

Migration başarıyla çalıştırıldı. Şimdi sistemi test edebiliriz.

## 🧪 Test Adımları

### 1. Brevo Dashboard Kontrolü
1. Git: https://app.brevo.com
2. Login yap
3. **Senders & IP** bölümüne git
4. Sender email'in doğrulanmış olduğunu kontrol et
5. Eğer doğrulanmamışsa:
   - Email ekle (örn: `noreply@yourdomain.com` veya kendi email'in)
   - Doğrulama linkine tıkla
   - Vercel'de güncelle: `vercel env add BREVO_SENDER_EMAIL`

### 2. Frontend Test (Manuel)

**A. Signup Test:**
1. Git: https://new-university-project.vercel.app/signup
2. Yeni bir hesap oluştur:
   - First Name: Test
   - Last Name: User
   - Email: (gerçek email adresin)
   - Password: Test123456
3. "Sign Up" butonuna tıkla
4. Otomatik olarak `/verify-email` sayfasına yönlendirilmelisin
5. Email'ini kontrol et - 6 haneli kod gelmiş olmalı

**B. Email Verification Test:**
1. Email'den 6 haneli kodu kopyala
2. Verification sayfasında kodu gir
3. "Verify Email" butonuna tıkla
4. Başarılı mesajı görmeli ve login sayfasına yönlendirilmelisin
5. Welcome email gelmiş olmalı

**C. Login Test (Unverified):**
1. Başka bir hesap oluştur ama verify etme
2. Login sayfasına git
3. Bu hesapla login olmaya çalış
4. Hata mesajı görmeli: "Please verify your email before logging in"

**D. Login Test (Verified):**
1. Verify ettiğin hesapla login ol
2. Başarıyla giriş yapmalısın

**E. Resend Code Test:**
1. Yeni bir hesap oluştur
2. Verification sayfasında "Resend Code" butonuna tıkla
3. Yeni kod email'e gelmeli
4. 60 saniye bekle
5. Tekrar "Resend Code" yapabilmelisin

### 3. Backend Logs Kontrolü

Vercel logs'u kontrol et:

```bash
vercel logs --follow
```

Şunları görmeli:
- ✅ Verification email sent to [email]
- ✅ Email sent successfully
- 📧 Verification code for [email]: [code] (fallback durumunda)

### 4. Database Kontrolü

Supabase'de kontrol et:

```sql
-- Yeni oluşturulan kullanıcıyı kontrol et
SELECT 
  id, 
  email, 
  email_verified, 
  verification_code, 
  verification_code_expires,
  created_at
FROM users 
WHERE email = 'test@example.com';

-- Email verified olmayanları listele
SELECT email, email_verified, created_at
FROM users
WHERE email_verified = false
ORDER BY created_at DESC;
```

## 🐛 Troubleshooting

### Email Gelmiyor?

1. **Spam klasörünü kontrol et**
2. **Brevo dashboard'da email gönderimini kontrol et:**
   - Transactional → Email Activity
   - Son gönderilen emailleri gör
3. **Vercel logs'u kontrol et:**
   ```bash
   vercel logs
   ```
4. **Brevo API key'i kontrol et:**
   - Dashboard → SMTP & API → API Keys
   - Key'in aktif olduğundan emin ol

### Verification Code Expired?

- Kod 10 dakika sonra expire oluyor
- "Resend Code" butonuna tıkla
- Yeni kod gelecek

### Login Yapamıyorum?

1. Email verified mi kontrol et:
   ```sql
   SELECT email, email_verified FROM users WHERE email = 'your@email.com';
   ```
2. Eğer false ise, manuel olarak true yap:
   ```sql
   UPDATE users SET email_verified = true WHERE email = 'your@email.com';
   ```

### Resend Code Çalışmıyor?

- 60 saniye cooldown var
- Countdown bitene kadar bekle
- Sonra tekrar dene

## ✅ Success Criteria

Sistem başarılı çalışıyorsa:
- [ ] Signup sonrası verification sayfasına yönlendirme
- [ ] Email'e 6 haneli kod geliyor
- [ ] Kod doğrulama çalışıyor
- [ ] Welcome email geliyor
- [ ] Unverified kullanıcı login olamıyor
- [ ] Verified kullanıcı login olabiliyor
- [ ] Resend code çalışıyor
- [ ] Code expiration çalışıyor

## 📊 Test Sonuçları

Test sonuçlarını buraya yaz:

### Signup Test:
- [ ] Başarılı
- [ ] Hata: ___________

### Email Delivery:
- [ ] Verification email geldi
- [ ] Welcome email geldi
- [ ] Hata: ___________

### Code Verification:
- [ ] Kod doğrulandı
- [ ] Hata: ___________

### Login Tests:
- [ ] Unverified user login olamadı (doğru)
- [ ] Verified user login oldu (doğru)
- [ ] Hata: ___________

### Resend Code:
- [ ] Yeni kod geldi
- [ ] Cooldown çalışıyor
- [ ] Hata: ___________

---

**Test Tarihi**: _____________
**Test Eden**: _____________
**Sonuç**: ✅ Başarılı / ❌ Hata var
