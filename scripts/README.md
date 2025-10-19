# Scripts

## Build and Push Script

### Usage

```bash
./scripts/build-and-push.sh
```

### What it does

1. Runs `npm run build` to check for TypeScript errors
2. If build succeeds, pushes to GitHub
3. If build fails, stops and doesn't push

### Benefits

- ✅ Catches build errors before pushing to GitHub
- ✅ Faster feedback (local build vs Vercel build)
- ✅ Cleaner git history
- ✅ No failed builds in Vercel

### Manual alternative

```bash
npm run build && git push origin feature/befaring-module
```

