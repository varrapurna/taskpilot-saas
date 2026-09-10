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
|- app/                         # FRONTEND pages and layouts
|  |- page.js                  # Home page: /
|  |- account/                 # Create-account and sign-in screens
|  |- dashboard/               # Signed-in dashboard screen
|  |- onboard/                 # Taiga connection screens
|  `- api/                     # BACKEND HTTP endpoints: /api/*
|     |- auth/                # Sign-up, sign-in, reset-password, verify-email
|     |- register/            # Taiga/WhatsApp connection endpoint
|     `- webhook/             # WhatsApp webhook endpoint
|- server/                      # BACKEND code - never UI components
|  |- auth/                    # Account, session, cookie helpers
|  |- database/                # PocketBase data access
|  |- http/                    # API response and CORS helpers
|  |- integrations/            # Taiga, WhatsApp, and Gemini clients
|  |- security/                # Encryption helpers
|  `- whatsapp/                # Meta config, signature check, saved replies
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
| A page or a visible screen | `app/` |
| A page style file | Beside its page in `app/` |
| A button, form, or UI component | `app/` in the relevant feature folder |
| A new HTTP API endpoint | `app/api/<feature>/route.js` |
| Database or PocketBase code | `server/database/` |
| Taiga, WhatsApp, or AI integration code | `server/integrations/` |
| Password, encryption, CORS, or signature code | `server/security/`, `server/http/`, or `server/whatsapp/` |
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
