# FieldNote Domain Setup

**Dato:** 14. oktober 2025  
**Status:** ✅ Produksjon live

---

## 🌐 DOMENER

### **Produksjon:**
- **URL:** https://fieldnote.no
- **Miljø:** Production
- **Deployment:** Vercel (automatic)
- **Branch:** `main`

### **Development:**
- **URL:** https://dev.fieldnote.no
- **Miljø:** Development/Staging
- **Deployment:** Vercel (automatic)
- **Branch:** `develop` eller `dev`

---

## 🔧 KONFIGURASJON

### **Vercel Project Settings:**

#### **Produksjon (fieldnote.no):**
```json
{
  "name": "fieldnote-production",
  "domains": ["fieldnote.no", "www.fieldnote.no"],
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://fieldnote.no",
    "NODE_ENV": "production"
  }
}
```

#### **Development (dev.fieldnote.no):**
```json
{
  "name": "fieldnote-dev",
  "domains": ["dev.fieldnote.no"],
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://dev.fieldnote.no",
    "NODE_ENV": "development"
  }
}
```

---

## 🔐 ENVIRONMENT VARIABLES

### **Produksjon:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[production-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[production-service-role-key]

# Tripletex
NEXT_PUBLIC_TRIPLETEX_API_URL=https://tripletex.no/v2
TRIPLETEX_API_KEY=[production-api-key]
TRIPLETEX_API_TOKEN=[production-api-token]

# App
NEXT_PUBLIC_APP_URL=https://fieldnote.no
NODE_ENV=production

# Email (hvis relevant)
SMTP_HOST=[production-smtp-host]
SMTP_PORT=587
SMTP_USER=[production-smtp-user]
SMTP_PASSWORD=[production-smtp-password]
```

### **Development:**
```bash
# Supabase (kan bruke samme eller egen dev database)
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[dev-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[dev-service-role-key]

# Tripletex (kan bruke test API)
NEXT_PUBLIC_TRIPLETEX_API_URL=https://tripletex.no/v2
TRIPLETEX_API_KEY=[dev-api-key]
TRIPLETEX_API_TOKEN=[dev-api-token]

# App
NEXT_PUBLIC_APP_URL=https://dev.fieldnote.no
NODE_ENV=development
```

---

## 🚀 DEPLOYMENT WORKFLOW

### **Produksjon:**
```bash
# 1. Push til main branch
git checkout main
git pull origin main
git merge feature/befaring-module
git push origin main

# 2. Vercel deploys automatically
# 3. Test på https://fieldnote.no
```

### **Development:**
```bash
# 1. Push til develop/dev branch
git checkout develop
git pull origin develop
git merge feature/befaring-module
git push origin develop

# 2. Vercel deploys automatically
# 3. Test på https://dev.fieldnote.no
```

---

## 📋 DNS CONFIGURATION

### **A Records:**
```
fieldnote.no        → 76.76.21.21 (Vercel)
www.fieldnote.no    → 76.76.21.21 (Vercel)
dev.fieldnote.no    → 76.76.21.21 (Vercel)
```

### **CNAME Records:**
```
fieldnote.no        → cname.vercel-dns.com
www.fieldnote.no    → cname.vercel-dns.com
dev.fieldnote.no    → cname.vercel-dns.com
```

---

## 🔒 SSL/TLS

- ✅ Automatisk SSL via Vercel
- ✅ HTTPS enforced
- ✅ HSTS enabled
- ✅ Certificate auto-renewal

---

## 📊 MONITORING

### **Produksjon:**
- **Vercel Analytics:** https://vercel.com/dashboard
- **Error Tracking:** Vercel Logs
- **Performance:** Vercel Speed Insights

### **Development:**
- **Vercel Analytics:** https://vercel.com/dashboard
- **Error Tracking:** Vercel Logs
- **Preview Deployments:** Per PR

---

## 🧪 TESTING CHECKLIST

### **Før produksjon deployment:**
- [ ] Test på dev.fieldnote.no
- [ ] Verifiser alle features
- [ ] Sjekk database connections
- [ ] Test Tripletex integration
- [ ] Sjekk bilder/uploads
- [ ] Test på mobil/tablet
- [ ] Performance test

### **Etter produksjon deployment:**
- [ ] Test på fieldnote.no
- [ ] Verifiser alle features
- [ ] Sjekk error logs
- [ ] Test på forskjellige enheter
- [ ] Sjekk analytics

---

## 🔄 ROLLBACK PROCEDURE

### **Hvis noe går galt:**
```bash
# 1. Rollback i Vercel
# Gå til Vercel Dashboard → Deployments → Rollback

# 2. Eller revert commit
git revert HEAD
git push origin main

# 3. Eller checkout forrige commit
git checkout [previous-commit-hash]
git push origin main --force
```

---

## 📝 NOTATER

- **Registrert:** 14. oktober 2025
- **Registrar:** (din registrar)
- **Expiry:** (dato)
- **Auto-renewal:** Ja (anbefalt)

---

## 🔗 RELATERTE FILER

- `vercel.json` - Vercel konfigurasjon
- `.env.production` - Production environment variables
- `.env.development` - Development environment variables
- `README.md` - Hoveddokumentasjon

---

**Status:** ✅ Produksjon live på fieldnote.no  
**Dev:** ✅ Dev live på dev.fieldnote.no

