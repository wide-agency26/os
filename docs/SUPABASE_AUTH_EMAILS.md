# Supabase invite & auth emails

Client invitation emails use `inviteUserByEmail` with `redirectTo` = `{NEXT_PUBLIC_SITE_URL}/auth/callback`.

## Fix localhost links in production

1. **Supabase Dashboard** → Authentication → **URL configuration**
   - **Site URL**: `https://os-bice-nine.vercel.app` (production URL, no trailing slash)
   - **Redirect URLs**: add `https://os-bice-nine.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` for local dev

2. **Vercel** (and local `.env.local`):
   - Production/Preview: `NEXT_PUBLIC_SITE_URL=https://os-bice-nine.vercel.app`
   - Development: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

3. **Email templates** (Authentication → Email templates → **Invite user**):

Replace the default plain body with branded HTML, for example:

```html
<h2>Welcome to WIDE OS</h2>
<p>You've been invited to your client portal. Click below to set your password and get started.</p>
<p><a href="{{ .ConfirmationURL }}">Accept invitation</a></p>
<p>If you didn't expect this email, you can ignore it.</p>
```

The `{{ .ConfirmationURL }}` variable is required — it includes the correct redirect.

4. Re-send invites after changing Site URL; old emails keep the previous link.
