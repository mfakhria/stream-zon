# Deploying Streamzon on Vercel

This repository is split into two runtime pieces:

- Frontend: Next.js app deployed to Vercel
- Signaling: Socket.IO server in `server/index.ts`, deployed separately on a Node host such as Railway, Render, Fly.io, or a VPS

The current signaling server should not be deployed as a Vercel Function because it depends on a persistent Socket.IO server process.

## 1. Deploy the frontend to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository into Vercel.
3. Keep the project root at the repository root.
4. Vercel should auto-detect `Next.js`.
5. Add the environment variables listed below before the first production deploy.

## 2. Configure Vercel environment variables

Add these in the Vercel project settings for both `Production` and `Preview` as needed:

- `NEXT_PUBLIC_APP_URL`
  Example: `https://streamzon.vercel.app`
- `NEXT_PUBLIC_SIGNALING_URL`
  Example: `https://streamzon-signaling.up.railway.app`
- `NEXT_PUBLIC_MAX_PARTICIPANTS`
  Example: `5`
- `ICE_SERVERS_JSON`
  Example: `[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp"]}]`
- `TURN_USERNAME`
- `TURN_PASSWORD`

Notes:

- `ICE_SERVERS_JSON`, `TURN_USERNAME`, and `TURN_PASSWORD` are used on the Next.js server side and then passed to the browser because WebRTC clients need TURN credentials.
- For production, prefer TURN credentials that can be rotated or generated with short-lived auth rather than permanent shared credentials.
- If you use Preview Deployments, your signaling server CORS settings must allow the preview domain too.

## 3. Deploy the signaling server separately

The signaling service needs these environment variables:

- `SIGNALING_PORT`
  Example: `4000`
- `SIGNALING_ALLOWED_ORIGIN`
  Example: `https://streamzon.vercel.app`
- `NEXT_PUBLIC_MAX_PARTICIPANTS`
  Example: `5`

You can run it with:

```bash
npm run dev:signaling
```

Or in production on your Node host:

```bash
npx tsx server/index.ts
```

If your provider expects a start command, use:

```bash
npx tsx server/index.ts
```

## 4. CORS and domains

- Set `SIGNALING_ALLOWED_ORIGIN` to your Vercel production domain.
- If you want Preview Deployments to work too, use a comma-separated list:

```text
https://streamzon.vercel.app,https://streamzon-git-feature-yourteam.vercel.app
```

- After you add a custom domain in Vercel, update `NEXT_PUBLIC_APP_URL` and `SIGNALING_ALLOWED_ORIGIN` to that custom domain.

## 5. TURN and HTTPS

- Vercel already provides HTTPS for the frontend.
- Your signaling server should also be served over HTTPS.
- TURN is strongly recommended for public internet use. STUN alone is not reliable enough for many NAT and firewall combinations.

## 6. Recommended first deploy checklist

- Frontend opens successfully from the Vercel production URL
- `NEXT_PUBLIC_SIGNALING_URL` points to the live signaling server
- The signaling server accepts WebSocket connections from the Vercel domain
- Creating a room works
- Joining a room from another browser works
- Screen sharing works over HTTPS
- Room chat messages appear in both clients
- Host leaving closes the room for viewers

## 7. Commands used locally before deploy

These are the checks worth running before pushing:

```bash
npm run typecheck
npm run lint
npm run build
```
