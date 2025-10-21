# Tripletex Compliance Plan - Trinnvis Implementering

## 🎯 **GODKJENT PLAN**

### **Fase 1: Minimal compliance (4-6 timer)** ✅ **FULLFØRT**
- ✅ Fields-filtrering i GET-kall (EMPLOYEE_FIELDS, PROJECT_FIELDS, ACTIVITY_FIELDS)
- ✅ Basic checksum-støtte (lagring av checksums)
- ✅ Oppdater sync-funksjoner med fields + checksum
- ✅ Test mot Tripletex test-miljø
- ✅ User-Agent og X-Requested-With headers

### **Fase 2: Webhook-støtte (4-6 timer)** ✅ **FULLFØRT**
- ✅ Opprett webhook edge function
- ✅ Registrer webhooks i Tripletex
- ✅ Test webhook-flyt
- ✅ Integrer med eksisterende sync
- ✅ Proxy-løsning for autentisering
- ✅ Webhook-flyt fungerer for project.create events

### **Fase 3: Optimalisering (4-6 timer)** ⏳ **FREMOVER**
- ❌ changesSince-parametere for differensielle kall
- ❌ Intelligent sync-intervaller
- ❌ Avansert checksum-logikk med Tripletex' egen mekanisme
- ❌ Performance-optimalisering
- ❌ Omfattende testing

---

## 📊 **NÅVÆRENDE GET-KALL SOM TRENGER ENDRING:**

### **1. Employee Sync**
```typescript
// Nåværende:
callTripletexAPI(`/employee?count=${pageSize}&page=${currentPage}`, 'GET', undefined, orgId)

// Nytt (Fase 1):
callTripletexAPI(`/employee?count=${pageSize}&page=${currentPage}&fields=id,firstName,lastName,email,isActive&changesSince=${lastSync}`, 'GET', undefined, orgId)
```

### **2. Project Sync**
```typescript
// Nåværende:
callTripletexAPI('/project?count=100', 'GET', undefined, orgId)

// Nytt (Fase 1):
callTripletexAPI(`/project?count=100&fields=id,number,displayName,isActive,isClosed&changesSince=${lastSync}`, 'GET', undefined, orgId)
```

### **3. Activity Sync**
```typescript
// Nåværende:
callTripletexAPI('/activity?count=1000', 'GET', undefined, orgId)

// Nytt (Fase 1):
callTripletexAPI(`/activity?count=1000&fields=id,name,isActive&changesSince=${lastSync}`, 'GET', undefined, orgId)
```

### **4. Timesheet Sync**
```typescript
// Nåværende:
callTripletexAPI(`/timesheet/entry/${tripletexEntryId}`, 'GET', undefined, orgId)

// Nytt (Fase 1):
callTripletexAPI(`/timesheet/entry/${tripletexEntryId}?fields=id,date,employee,project,activity,hours&changesSince=${lastSync}`, 'GET', undefined, orgId)
```

---

## 🚀 **STATUS:**

- ✅ **Plan godkjent** av bruker
- ✅ **Trinnvis tilnærming** valgt (Fase 1 → 2 → 3)
- ⏳ **Venter på kritisk feil-fiks** før implementering starter
- 🎯 **Neste steg:** Fase 1 (Minimal compliance) - 4-6 timer

---

## 📋 **FIELDS-DEFINISJONER:**

```typescript
const EMPLOYEE_FIELDS = 'id,firstName,lastName,email,isActive,department';
const PROJECT_FIELDS = 'id,number,displayName,isActive,isClosed,customer';
const ACTIVITY_FIELDS = 'id,name,isActive,project';
const TIMESHEET_FIELDS = 'id,date,employee,project,activity,hours';
```

---

**Opprettet:** 21. oktober 2025  
**Status:** Klar for implementering etter kritisk feil-fiks
