# TAU Community Platform - Vercel Deployment Guide

Bu rehber TAU Community Platform'unu Vercel'de nasÄ±l deploy edeceÄŸinizi gÃ¶sterir.

## Ã–n Gereksinimler

1. **Vercel HesabÄ±**: [vercel.com](https://vercel.com) Ã¼zerinden Ã¼cretsiz hesap oluÅŸturun
2. **Supabase Database**: âœ… Zaten kurulmuÅŸ (bzjekrzqnqyqphkaqses.supabase.co)
3. **Redis**: Redis instance (Upstash Redis Ã¶nerilir)
4. **Google OAuth**: Google Cloud Console'dan OAuth credentials

## AdÄ±m 1: Supabase Database Kurulumu âœ…

Supabase database'iniz zaten hazÄ±r:
- **Project URL**: https://bzjekrzqnqyqphkaqses.supabase.co
- **Database Password**: Asdasadas123

### Database Schema Kurulumu
1. Supabase Dashboard'a gidin: https://supabase.com/dashboard
2. Projenizi seÃ§in (bzjekrzqnqyqphkaqses)
3. Sol menÃ¼den "SQL Editor" seÃ§in
4. `supabase-setup.sql` dosyasÄ±nÄ±n iÃ§eriÄŸini kopyalayÄ±p Ã§alÄ±ÅŸtÄ±rÄ±n

Bu script ÅŸunlarÄ± oluÅŸturacak:
- TÃ¼m gerekli tablolarÄ± (users, clubs, activities, applications, etc.)
- Ä°ndeksleri ve trigger'larÄ±
- Ã–rnek test verilerini

### Test KullanÄ±cÄ±larÄ±
Script Ã§alÄ±ÅŸtÄ±ktan sonra ÅŸu hesaplarla giriÅŸ yapabilirsiniz:
- **Super Admin**: admin@tau.edu.az / password123
- **Club Presidents**: president.robotics@tau.edu.az / password123
- **Students**: student1@tau.edu.az / password123

## AdÄ±m 2: Redis Kurulumu

### Upstash Redis (Ã–nerilen)
1. [upstash.com](https://upstash.com) hesabÄ± oluÅŸturun
2. Yeni Redis database oluÅŸturun
3. Redis URL'ini kopyalayÄ±n

## AdÄ±m 3: Google OAuth Kurulumu

1. [Google Cloud Console](https://console.cloud.google.com) aÃ§Ä±n
2. Yeni proje oluÅŸturun veya mevcut projeyi seÃ§in
3. APIs & Services > Credentials bÃ¶lÃ¼mÃ¼ne gidin
4. OAuth 2.0 Client ID oluÅŸturun:
   - Application type: Web application
   - Authorized JavaScript origins: `https://your-app-name.vercel.app`
   - Authorized redirect URIs: `https://your-app-name.vercel.app/auth/callback`
5. Client ID ve Client Secret'i kaydedin

## AdÄ±m 4: Vercel'de Deployment

### GitHub Ã¼zerinden Deploy
1. Vercel dashboard'a gidin
2. "New Project" tÄ±klayÄ±n
3. GitHub repository'nizi seÃ§in (`TAU-Community`)
4. Import tÄ±klayÄ±n

### Environment Variables Ayarlama
Vercel dashboard'da Settings > Environment Variables bÃ¶lÃ¼mÃ¼nde ÅŸu deÄŸiÅŸkenleri ekleyin:

```bash
# Supabase Database (Production)
DATABASE_URL=postgresql://postgres:Asdasadas123@db.bzjekrzqnqyqphkaqses.supabase.co:5432/postgres?sslmode=require

# JWT Secrets (Generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters
JWT_EXPIRES_IN=7d

# Redis (Upstash recommended for production)
REDIS_URL=redis://username:password@host:port

# Google OAuth
GOOGLE_CLIENT_ID=870144213765-j3988hpuj4dlhgdu1nb67u4n7l6dlvfs.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# CORS
CORS_ORIGIN=https://your-app-name.vercel.app

# Environment
NODE_ENV=production

# Frontend Environment Variables
VITE_API_BASE_URL=https://your-app-name.vercel.app/api
VITE_GOOGLE_CLIENT_ID=870144213765-j3988hpuj4dlhgdu1nb67u4n7l6dlvfs.apps.googleusercontent.com
VITE_APP_NAME=TAU KAYS
VITE_APP_DESCRIPTION=TAU Club and Activity Management System
```

### Build Settings
Vercel otomatik olarak `vercel.json` dosyasÄ±nÄ± okuyacak ve doÄŸru build ayarlarÄ±nÄ± kullanacaktÄ±r.

## AdÄ±m 5: Database Migration

Ä°lk deployment'tan sonra:

1. Vercel Functions sekmesinde backend function'Ä±nÄ± bulun
2. Database migration'larÄ± Ã§alÄ±ÅŸtÄ±rmak iÃ§in Vercel CLI kullanÄ±n:
   ```bash
   npx vercel env pull .env.local
   npm run db:migrate:prod
   ```

## AdÄ±m 6: Domain Ayarlama (Opsiyonel)

1. Vercel dashboard'da Settings > Domains
2. Custom domain ekleyin
3. DNS ayarlarÄ±nÄ± gÃ¼ncelleyin

## Troubleshooting

### Build HatasÄ±
- Environment variables'larÄ±n doÄŸru ayarlandÄ±ÄŸÄ±ndan emin olun
- Build logs'larÄ± kontrol edin

### Database BaÄŸlantÄ± HatasÄ±
- DATABASE_URL'in doÄŸru formatda olduÄŸunu kontrol edin
- Database'in public access'e aÃ§Ä±k olduÄŸunu kontrol edin

### CORS HatasÄ±
- CORS_ORIGIN environment variable'Ä±nÄ±n doÄŸru domain'i gÃ¶sterdiÄŸini kontrol edin

## GÃ¼venlik NotlarÄ±

1. **JWT_SECRET**: GÃ¼Ã§lÃ¼, rastgele bir string kullanÄ±n (minimum 32 karakter)
2. **Database**: Production database'i iÃ§in gÃ¼Ã§lÃ¼ ÅŸifre kullanÄ±n
3. **Environment Variables**: Hassas bilgileri asla kod iÃ§inde saklamayÄ±n
4. **HTTPS**: Sadece HTTPS Ã¼zerinden eriÅŸim saÄŸlayÄ±n

## Monitoring

Vercel otomatik olarak:
- Performance monitoring
- Error tracking
- Analytics
- Function logs

saÄŸlar. Dashboard Ã¼zerinden bu metrikleri takip edebilirsiniz.

## Destek

Deployment sÄ±rasÄ±nda sorun yaÅŸarsanÄ±z:
1. Vercel documentation'Ä± kontrol edin
2. GitHub Issues'da sorun bildirin
3. Vercel community'sine baÅŸvurun
