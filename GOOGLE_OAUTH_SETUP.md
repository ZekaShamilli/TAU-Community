# Google OAuth Setup Talimatları

Bu proje Google OAuth ile giriş özelliğini destekler. Aşağıdaki adımları takip ederek Google OAuth'u aktif hale getirebilirsiniz.

## 1. Google Cloud Console Setup

### Adım 1: Google Cloud Console'a Git
- https://console.cloud.google.com/ adresine git
- Google hesabınla giriş yap

### Adım 2: Proje Oluştur/Seç
- Yeni proje oluştur veya mevcut projeyi seç
- Proje adı: "TAU KAYS" (veya istediğin isim)

### Adım 3: OAuth Consent Screen Ayarla
- **APIs & Services > OAuth consent screen** git
- **User Type**: "External" seç (test için)
- **App name**: "TAU KAYS"
- **User support email**: Email adresin
- **Developer contact information**: Email adresin
- **Save and Continue** tıkla
- **Scopes** sayfasında default ayarları bırak
- **Test users** sayfasında test email'lerini ekle (isteğe bağlı)

### Adım 4: OAuth 2.0 Client ID Oluştur
- **APIs & Services > Credentials** git
- **"+ CREATE CREDENTIALS" > "OAuth 2.0 Client IDs"** tıkla
- **Application type**: "Web application" seç
- **Name**: "TAU KAYS Web Client"

### Adım 5: Authorized Origins ve Redirect URIs Ekle
**Authorized JavaScript origins:**
```
http://localhost:3001
http://127.0.0.1:3001
```

**Authorized redirect URIs:**
```
http://localhost:3001/login
http://localhost:3001/signup
http://localhost:3001
```

### Adım 6: Credentials'ı Al
- **Create** butonuna tıkla
- **Client ID** ve **Client Secret**'i kopyala

## 2. Environment Variables Güncelle

### Backend (.env dosyası):
```env
GOOGLE_CLIENT_ID="your-actual-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-actual-client-secret"
```

### Frontend (.env dosyası):
```env
VITE_GOOGLE_CLIENT_ID="your-actual-client-id.apps.googleusercontent.com"
```

## 3. Test Et

1. Backend ve frontend'i restart et
2. http://localhost:3001/login sayfasına git
3. "Continue with Google" butonuna tıkla
4. Google OAuth popup'ı açılmalı
5. Google hesabınla giriş yap
6. Başarılı olursa dashboard'a yönlendirileceksin

## 4. Production Setup

Production'da deploy ederken:

1. **Google Cloud Console'da production domain'ini ekle:**
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com/login`

2. **Environment variables'ı production'da güncelle**

3. **OAuth Consent Screen'i "In production" yap** (Google review gerekebilir)

## Troubleshooting

### "redirect_uri_mismatch" hatası:
- Google Cloud Console'da redirect URI'ları kontrol et
- Tam URL'leri ekle (http://localhost:3001/login)

### "origin_mismatch" hatası:
- Authorized JavaScript origins'i kontrol et
- Port numarasını dahil et (http://localhost:3001)

### "invalid_client" hatası:
- Client ID'yi kontrol et
- Environment variables'ı restart et

### Google popup açılmıyor:
- Browser popup blocker'ı kontrol et
- HTTPS gerekebilir (production'da)

## Güvenlik Notları

- Client Secret'i asla frontend'de kullanma
- Production'da HTTPS kullan
- Test users listesini production'da kaldır
- OAuth consent screen'i production'a geçir