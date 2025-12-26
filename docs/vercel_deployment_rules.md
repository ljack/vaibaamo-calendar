# Vercel Deployment Protection Bypass Rules

To ensure your protected preview works without logging into Vercel, follow these rules for bypassing deployment protection.

## Recommended Method (Headers)

Prefer sending `x-vercel-protection-bypass: <secret>` and, optionally, `x-vercel-set-bypass-cookie: true` as HTTP headers.

This is the cleanest method for automated tools like Postman, curl, or custom scripts.

## Fallback Method (Query Parameters)

If you can’t set headers (e.g., in a standard browser navigation), append both query parameters to the URL:

```
?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true
```

**Behavior:**
This will cause Vercel to:
1.  Validate the secret.
2.  Set a bypass cookie in your browser.
3.  Redirect you back to the bare URL (without parameters).

This is the preferred method for manual verification in a browser.

## Iframe Usage

If you need to load the preview within an iframe, set the cookie parameter to `samesitenone` instead of `true`:

```
x-vercel-set-bypass-cookie=samesitenone
```

## Automated Testing (Playwright)

For automated testing with Playwright, configure your `playwright.config.ts` to send the header automatically:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true' // Optional
    }
  }
});
```

Using this pattern ensures that your automated tests or preview links can bypass deployment protection without requiring an active Vercel session.
