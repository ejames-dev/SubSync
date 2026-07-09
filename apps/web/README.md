# SubSync Web

Next.js dashboard for SubSync. In normal development, run it from the repo root so the API base URL is set by the root script.

## Local development

Start the API first:

```bash
cd ../..
npm run dev:api
```

Then start the web UI in a second terminal:

```bash
npm run dev:web
```

The root `dev:web` script starts Next.js on `http://127.0.0.1:3000` and sets `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:43100/api`.

Open `http://127.0.0.1:3000/dashboard`.

## Useful commands

```bash
npm run build --workspace web
npm run lint --workspace web
npm run format --workspace web
```
