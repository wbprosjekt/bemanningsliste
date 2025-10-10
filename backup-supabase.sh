#!/bin/bash

# Supabase Backup Script
# Creates a complete backup of database, functions, and configuration
# Run before any major changes!

set -e  # Exit on error

# Configuration
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supabase Backup - Starting${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Created backup directory: $BACKUP_DIR"

# ============================================
# 1. DATABASE BACKUP
# ============================================
echo ""
echo -e "${BLUE}[1/5] Backing up database...${NC}"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set!${NC}"
    echo "Please set it first:"
    echo "  export DATABASE_URL='postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'"
    exit 1
fi

# Full database dump
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database-full.sql"
echo -e "${GREEN}✓${NC} Database backed up to: $BACKUP_DIR/database-full.sql"

# Schema only (for reference)
pg_dump "$DATABASE_URL" --schema-only > "$BACKUP_DIR/database-schema-only.sql"
echo -e "${GREEN}✓${NC} Schema backed up to: $BACKUP_DIR/database-schema-only.sql"

# Data only (for reference)
pg_dump "$DATABASE_URL" --data-only > "$BACKUP_DIR/database-data-only.sql"
echo -e "${GREEN}✓${NC} Data backed up to: $BACKUP_DIR/database-data-only.sql"

# ============================================
# 2. EDGE FUNCTIONS BACKUP
# ============================================
echo ""
echo -e "${BLUE}[2/5] Backing up Edge Functions...${NC}"

# Create functions directory
mkdir -p "$BACKUP_DIR/edge-functions"

# List of functions to backup
FUNCTIONS=(
    "tripletex-api"
    "email-reminders"
    "nightly-sync"
    "calendar-sync"
    "onboarding-setup"
    "tripletex-create-profile"
    "validate-invite-code"
)

for func in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$func" ]; then
        cp -r "supabase/functions/$func" "$BACKUP_DIR/edge-functions/"
        echo -e "${GREEN}✓${NC} Backed up function: $func"
    else
        echo -e "  ⚠ Function not found: $func (skipping)"
    fi
done

# Backup shared folder
if [ -d "supabase/functions/_shared" ]; then
    cp -r "supabase/functions/_shared" "$BACKUP_DIR/edge-functions/"
    echo -e "${GREEN}✓${NC} Backed up _shared folder"
fi

# ============================================
# 3. CONFIGURATION FILES BACKUP
# ============================================
echo ""
echo -e "${BLUE}[3/5] Backing up configuration files...${NC}"

mkdir -p "$BACKUP_DIR/config"

# Backup config.toml
if [ -f "supabase/config.toml" ]; then
    cp "supabase/config.toml" "$BACKUP_DIR/config/"
    echo -e "${GREEN}✓${NC} Backed up config.toml"
fi

# Backup migrations
if [ -d "supabase/migrations" ]; then
    cp -r "supabase/migrations" "$BACKUP_DIR/config/"
    echo -e "${GREEN}✓${NC} Backed up migrations"
fi

# ============================================
# 4. RLS POLICIES BACKUP
# ============================================
echo ""
echo -e "${BLUE}[4/5] Backing up RLS policies...${NC}"

# Export RLS policies for all tables
psql "$DATABASE_URL" -c "
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
" > "$BACKUP_DIR/rls-policies.txt"

echo -e "${GREEN}✓${NC} RLS policies backed up to: $BACKUP_DIR/rls-policies.txt"

# ============================================
# 5. DATABASE CONFIGURATION BACKUP
# ============================================
echo ""
echo -e "${BLUE}[5/5] Backing up database configuration...${NC}"

# Try to export database settings (secrets won't show values, but we'll know they exist)
psql "$DATABASE_URL" -c "
SELECT name, setting 
FROM pg_settings 
WHERE name LIKE 'app.%'
ORDER BY name;
" > "$BACKUP_DIR/database-settings.txt" 2>/dev/null || echo "  ⚠ Could not export database settings (may require superuser)"

# List installed extensions
psql "$DATABASE_URL" -c "
SELECT extname, extversion 
FROM pg_extension 
ORDER BY extname;
" > "$BACKUP_DIR/extensions.txt"

echo -e "${GREEN}✓${NC} Database configuration backed up"

# ============================================
# 6. CREATE BACKUP MANIFEST
# ============================================
echo ""
echo -e "${BLUE}Creating backup manifest...${NC}"

cat > "$BACKUP_DIR/BACKUP_MANIFEST.md" << EOF
# Supabase Backup - $TIMESTAMP

## Backup Information

- **Date:** $(date)
- **Database URL:** ${DATABASE_URL%%@*}@[REDACTED]
- **Backup Directory:** $BACKUP_DIR

## Contents

### Database Backups
- \`database-full.sql\` - Complete database dump (schema + data)
- \`database-schema-only.sql\` - Schema only
- \`database-data-only.sql\` - Data only
- \`rls-policies.txt\` - Row Level Security policies
- \`database-settings.txt\` - Database configuration
- \`extensions.txt\` - Installed extensions

### Edge Functions
$(for func in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$func" ]; then
        echo "- \`edge-functions/$func/\` - $(ls -1 supabase/functions/$func/*.ts 2>/dev/null | wc -l | tr -d ' ') TypeScript files"
    fi
done)

### Configuration
- \`config/config.toml\` - Supabase configuration
- \`config/migrations/\` - Database migrations

## Restoration

### Full Database Restore
\`\`\`bash
psql "\$DATABASE_URL" < database-full.sql
\`\`\`

### Individual Function Restore
\`\`\`bash
supabase functions deploy tripletex-api --project-ref edge-functions/tripletex-api
\`\`\`

### Verify Restoration
\`\`\`bash
# Check table count
psql "\$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check function count
supabase functions list
\`\`\`

## Important Notes

⚠️ **Before restoring:**
1. This backup does NOT include:
   - Encrypted secrets (you need to back these up separately)
   - Service role keys
   - API keys (from environment variables)

2. If restoring to a different project:
   - Update all references to project URLs
   - Regenerate service role keys
   - Reconfigure authentication providers

3. Test restoration in a staging environment first!

## Backup Size

\`\`\`
$(du -sh "$BACKUP_DIR" 2>/dev/null || echo "Calculating...")
\`\`\`

## Files in Backup

\`\`\`
$(find "$BACKUP_DIR" -type f | sed "s|$BACKUP_DIR/||" | sort)
\`\`\`

---

**Created by:** backup-supabase.sh  
**Status:** ✅ Complete
EOF

echo -e "${GREEN}✓${NC} Backup manifest created"

# ============================================
# SUMMARY
# ============================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Backup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "📦 ${GREEN}Backup Location:${NC}"
echo -e "   $BACKUP_DIR"
echo ""
echo -e "📋 ${GREEN}Backup Contents:${NC}"
echo -e "   $(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ') files"
echo -e "   $(du -sh "$BACKUP_DIR" | cut -f1) total size"
echo ""
echo -e "📄 ${GREEN}Key Files:${NC}"
echo -e "   • database-full.sql (complete backup)"
echo -e "   • edge-functions/ (all functions)"
echo -e "   • config/ (migrations & config)"
echo -e "   • BACKUP_MANIFEST.md (restoration guide)"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. ✅ Backup created successfully"
echo -e "2. 📝 Review BACKUP_MANIFEST.md for details"
echo -e "3. 💾 Save backup to secure location (1Password, encrypted drive)"
echo -e "4. 🧪 Test restoration in local environment (optional but recommended)"
echo -e "5. 🚀 Proceed with changes (you're now protected!)"
echo ""
echo -e "${GREEN}To restore from this backup:${NC}"
echo -e "   psql \$DATABASE_URL < $BACKUP_DIR/database-full.sql"
echo ""
echo -e "${BLUE}========================================${NC}"

