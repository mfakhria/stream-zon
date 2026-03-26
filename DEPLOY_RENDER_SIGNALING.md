# Deploy Streamzon Signaling to Render

This guide deploys only the signaling server from this repository to Render.

The frontend stays on Vercel.

This repo now also includes a Docker setup for signaling:

- `Dockerfile`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `docker-compose.signaling.yml`

## What Render will run

Render should run:

```bash
npx tsx server/index.ts
```

The signaling server now supports Render's `PORT` environment variable automatically.

## Before you start

Make sure:

- your frontend is already deployed on Vercel
- you know your Vercel production URL
- this repository is pushed to GitHub

## Step 1. Create a new Web Service in Render

1. Log in to Render.
2. Click `New` -> `Web Service`.
3. Connect your GitHub account if needed.
4. Select this repository.

Official docs:

- https://render.com/docs/web-services
- https://render.com/docs/deploy-node-express-app

## Step 2. Choose the runtime mode

You can deploy in either of these ways:

- Node runtime
- Docker runtime

### Option A. Node runtime

Use this if you want the simplest setup in Render.

### Option B. Docker runtime

Use this if you want Render to build from the included `Dockerfile`.

Both options work for this repo.

## Step 3. Fill in the Render service settings

Use these values:

- `Name`: `streamzon-signaling`
- `Region`: choose the closest region to most of your users
- `Branch`: your deploy branch, usually `main`
- `Runtime`: `Node` or `Docker`

If you choose `Node`, use:

- `Build Command`: `npm install`
- `Start Command`: `npx tsx server/index.ts`

If you choose `Docker`, Render will use the repository `Dockerfile` automatically, so you do not need separate build/start commands.

For testing only, you can choose the `Free` instance type.

Important free-tier note:

- Render Free spins down after 15 minutes of no inbound traffic and can take about a minute to wake up again.

Official docs:

- https://render.com/docs/free

## Step 4. Add environment variables in Render

In the Render service settings, add:

- `NEXT_PUBLIC_MAX_PARTICIPANTS=5`
- `SIGNALING_ALLOWED_ORIGIN=https://your-app.vercel.app`

Replace `https://your-app.vercel.app` with your real Vercel frontend URL.

If you want Preview Deployments from Vercel to connect too, use a comma-separated list:

```text
https://your-app.vercel.app,https://your-preview.vercel.app
```

Render provides `PORT` automatically. You do not need to set it manually unless you want to override it.

## Step 5. Deploy

1. Click `Create Web Service`.
2. Wait for the first build and deploy to finish.
3. Open the generated Render URL.

You should see no pretty page because this is a Socket.IO signaling server, but the deploy logs should show a line similar to:

```text
[streamzon] signaling server listening on http://localhost:10000
```

Render gives the service a public hostname like:

```text
https://streamzon-signaling.onrender.com
```

## Step 6. Connect Vercel frontend to Render

In your Vercel project environment variables, set:

- `NEXT_PUBLIC_SIGNALING_URL=https://streamzon-signaling.onrender.com`

Then redeploy the Vercel frontend.

## Step 7. Test end-to-end

Test this exact flow:

1. Open the Vercel frontend on device A.
2. Create a room as host.
3. Open the same Vercel frontend on device B.
4. Join using the room code.
5. Start screen sharing.
6. Confirm the viewer receives the stream.
7. Send a room chat message.
8. Confirm the message appears on both devices.

## Common issues

### Room join works, but stream does not appear on another device

This usually means signaling is working but WebRTC transport is failing.

Most common cause:

- no TURN server configured in Vercel frontend env

Render only hosts your signaling server. It does not replace TURN.

### CORS error

Make sure `SIGNALING_ALLOWED_ORIGIN` exactly matches your Vercel frontend origin, including `https://`.

### Service deploys, but Render says no open port detected

This is usually caused by the wrong start command or by ignoring `PORT`.

This repo already supports `PORT`, so use:

```bash
npx tsx server/index.ts
```

If you deploy with Docker, this is already handled by the included `Dockerfile`.

### Free service sleeps

That is normal on Render Free. The first connection after idle may be slow.

## Useful docs

- https://render.com/docs/web-services
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/docker
- https://render.com/docs/free
- https://render.com/docs/environment-variables
