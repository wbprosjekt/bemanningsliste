# Codex Prompt: Fix Upload Dialog Issue in BefaringPunktImageThumbnails

## 🐛 **PROBLEM**

In `src/components/fri-befaring/BefaringPunktImageThumbnails.tsx`, the upload dialog (`showUploadDialog`) is not showing when the "Legg til bilde" button is clicked, even though:
- ✅ State is set to `true` correctly
- ✅ `setShowUploadDialog(true)` is called
- ✅ Component re-renders with `showUploadDialog: true`
- ❌ But dialog never appears on screen

**Console logs show:**
```
🖼️ Button clicked, befaringPunktId: xxx Current state: false
🖼️ Setting state to true...
📸 BefaringPunktImageThumbnails mounted/updated: {..., showUploadDialog: true}
🖼️ State after 100ms: false  ← STATE REVERTS BACK
```

**Problem:** Component appears to be remounting and losing state, or the dialog is being blocked by z-index/portal issues.

---

## 📝 **WHAT WE NEED**

Fix the upload dialog so it:
1. Opens when "Legg til bilde" button is clicked
2. Shows the dialog with camera/upload options
3. Allows image upload (the upload logic already exists)
4. Works even when nested inside Card/Dialog contexts

---

## 🔍 **ROOT CAUSE ANALYSIS**

**File:** `src/components/fri-befaring/BefaringPunktImageThumbnails.tsx`

**Current implementation:**
- Dialog is at the bottom of the component (lines 548-733)
- Uses conditional rendering: `{showUploadDialog && <Dialog ...>}`
- Dialog uses Radix UI's Dialog component with Portal
- Has z-index styling: `z-[100]` and `style={{ zIndex: 10000 }}`

**Possible issues:**
1. **Component remounting:** Parent component may be remounting this component
2. **Portal blocking:** DialogPortal might be blocked by parent structure
3. **State resetting:** Something is resetting state immediately after setting it
4. **Nested dialog conflict:** May be conflicting with parent Dialog context

---

## 💡 **SOLUTIONS TO TRY**

### **Option 1: Move Dialog Outside Component Tree**
Instead of rendering dialog inside this component, lift state up to parent and render dialog at root level.

### **Option 2: Use Modal Instead of Dialog**
Replace `Dialog` with a custom Modal that doesn't rely on portals.

### **Option 3: Fix Portal Rendering**
Ensure DialogPortal renders at correct DOM level and isn't blocked.

### **Option 4: Use Ref to Persist State**
Use `useRef` to store dialog state across remounts.

### **Option 5: State Management with Context**
Create a shared context for dialog state that survives component remounts.

---

## 🎯 **PREFERRED APPROACH**

**Best solution:** Option 2 - Create a simple Modal component that doesn't use portals

**Why:**
- Avoids portal/nesting issues
- Simpler to debug
- More control over rendering
- Works in all contexts

**Implementation:**
```tsx
// Create a simple UploadImageModal component
// That renders as a fixed overlay
// Without using Dialog/DialogContent from Radix UI
```

---

## ✅ **EXPECTED BEHAVIOR AFTER FIX**

When user clicks "Legg til bilde" button:
1. Dialog/modal opens immediately
2. Shows upload interface with:
   - Camera button
   - File picker button
   - Drag & drop area
   - Image type selector (standard/før/etter)
3. User can select or capture image
4. Image uploads successfully
5. Dialog closes and images reload

---

## 🧪 **TESTING**

Test on:
- Mobile devices (primary use case)
- Desktop browsers
- Different screen sizes
- Check console for any errors

---

## 📋 **NOTES**

- Upload functionality already works (see `handleUpload` function)
- Dialog content is already complete (lines 560-729)
- Only issue is dialog not showing/rendering
- All state management, upload logic, and UI exists - just need to fix the dialog visibility

