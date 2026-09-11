# TaskPilot

TaskPilot brings Taiga task work into WhatsApp.

## Where to make changes

- **Website screens and design:** `app/(marketing)/`, `app/(auth)/`, or `app/(product)/`
- **Backend API endpoints:** `app/api/`
- **Backend business code:** `src/server/`
- **PocketBase migrations:** `database/pocketbase/migrations/`
- **Images and public files:** `public/`
- **AWS and Nginx setup:** `infrastructure/`
- **Deployment scripts:** `scripts/`

Read [the project structure guide](docs/PROJECT-STRUCTURE.md) before adding a new feature.

## Local development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Production flow

1. Create a feature branch from `main`.
2. Open a pull request into `main`.
3. GitHub checks the production build.
4. After merge, GitHub Actions deploys the change to AWS.
