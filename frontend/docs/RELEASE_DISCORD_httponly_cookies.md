# Security Update Release

## **v1.0.6 - Authentication Security Hardening**

Hey everyone! Just pushed a major security update to the raid planner. Here's what's new:

---

### **What Changed**

**Authentication is now more secure!**

Your login tokens are no longer stored in the browser's localStorage (which could be vulnerable to XSS attacks). Instead, they're now stored in **httpOnly cookies** that JavaScript can't access directly.

---

### **Technical Details** (for the nerds)

- **httpOnly Cookies** - Tokens stored server-side, invisible to browser scripts
- **SameSite=Lax** - Prevents cross-site request forgery (CSRF) attacks
- **Secure Flag** - Cookies only sent over HTTPS in production
- **Protected Logout** - Requires authentication to prevent forced logout attacks
- **Token Refresh** - Logout now properly clears cookies even with expired access tokens

---

### **What You Need to Do**

**Nothing!** Just log out and log back in, and you'll automatically use the new secure authentication.

---

### **Why This Matters**

This update protects your Discord account connection from potential XSS vulnerabilities. Even if a malicious script somehow ran on the page, it couldn't steal your authentication tokens.

---

### **Files Changed**
```
Backend:
  - app/routers/auth.py (cookie handling)
  - app/dependencies.py (token extraction)

Frontend:
  - stores/authStore.ts (auth state management)
  - services/api.ts (API client)
  - components/auth/ProtectedRoute.tsx
```

---

### **PR Link**
https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/pull/18

---

*Questions? Let me know!*
