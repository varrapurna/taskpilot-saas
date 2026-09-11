# TaskPilot project structure

This project has two separate applications:

```text
taskpilot/
|- taskpilot-saas/       # Website and application API
`- taskpilot-backend/    # Local PocketBase runtime and local database data
```

## `taskpilot-saas/` - website and application API

```text
taskpilot-saas/
|- app/                         # NEXT.JS ROUTES - this folder is required by Next.js
|  |- (marketing)/             # FRONTEND public pages (the folder name is not in the URL)
|  |  |- page.js              # Home page: /
|  |  `- how-it-works/       # Public explanation page: /how-it-works
|  |- (auth)/account/         # FRONTEND create-account and sign-in screens: /account/*
|  |- (product)/              # FRONTEND signed-in product screens
|  |  |- dashboard/          # /dashboard
|  |  `- onboard/            # /onboard and /onboard/taiga
|  `- api/                    # BACKEND HTTP endpoints: /api/*
|     |- auth/                # Sign-up, sign-in, reset-password, verify-email
|     |- register/            # Taiga/WhatsApp connection endpoint
|     `- webhook/             # WhatsApp webhook endpoint
|- src/
|  `- server/                  # BACKEND business code - never UI components
|     |- auth/                # Account, session, cookie helpers
|     |- database/            # PocketBase data access
|     |- http/                # API response and CORS helpers
|     |- integrations/        # Taiga, WhatsApp, and Gemini clients
|     |- security/            # Encryption helpers
|     `- whatsapp/            # Meta config, signature check, saved replies
|- database/
|  `- pocketbase/migrations/   # Versioned database changes deployed to AWS
|- public/                      # FRONTEND images and static files
|- infrastructure/              # Nginx and systemd configuration for AWS
|- scripts/                     # Deployment/setup scripts
|- docs/                        # Human-readable project guides
|- .github/workflows/           # GitHub build and deployment automation
`- .env.example                 # Names of required environment variables only
```

## Easy rule for new files

| If you are adding... | Put it here |
| --- | --- |
| A public marketing page | `app/(marketing)/` |
| A create-account or sign-in screen | `app/(auth)/account/` |
| A signed-in product page | `app/(product)/` |
| A page style file | Beside its page in the matching route folder |
| A button, form, or UI component | In a `_components/` folder beside the page that uses it |
| A new HTTP API endpoint | `app/api/<feature>/route.js` |
| Database or PocketBase code | `src/server/database/` |
| Taiga, WhatsApp, or AI integration code | `src/server/integrations/` |
| Password, encryption, CORS, or signature code | `src/server/security/`, `src/server/http/`, or `src/server/whatsapp/` |
| A database schema change | `database/pocketbase/migrations/` |
| An image | `public/images/` |
| AWS, Nginx, or service configuration | `infrastructure/` |

## `taskpilot-backend/` - local PocketBase runtime

```text
taskpilot-backend/
|- pocketbase.exe       # PocketBase program for local development
|- pb_data/             # Local database files - never edit or commit manually
`- pb_migrations/       # Migrations already used by the local runtime
```

For a new production database change, create the migration in
`taskpilot-saas/database/pocketbase/migrations/`. The AWS deployment script copies
that versioned migration into the PocketBase runtime. Do not copy `pb_data/` between
your computer and AWS.
