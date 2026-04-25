# Gen-Z Web Realtime Tester (Vercel + Localhost)

This is a minimal static web app to test your backend quickly:
- Login (JWT)
- Any REST endpoint via API tester
- Profile and favorites presence checks
- Availability toggle (online/offline)
- Realtime socket connection
- Chat events and receipts
- Unread badge sync
- WebRTC calling with socket signaling
- Post comments/replies and comment likes

## Why this is Vercel-fast
- Pure static files: no build pipeline needed
- Deploy directly from folder
- Works as SPA with fallback to index.html via vercel.json

## Files
- index.html: app UI
- styles.css: responsive layout and theme
- app.js: all logic (auth, APIs, socket, chat, call)
- vercel.json: Vercel SPA routing and no-store cache header

## Run on localhost
Option 1 (Python):
1. Open terminal in this folder
2. Run: python -m http.server 4173
3. Open: http://localhost:4173

Option 2 (Node):
1. Open terminal in this folder
2. Run: npx serve -l 4173 .
3. Open: http://localhost:4173

## Test flow (end-to-end)
1. Set API Base URL and Socket URL
2. Login with mobile + password
3. Go to Calling panel and enter target user ID
4. Click `Setup For Calling` (this sets online + connects socket)
5. Open same site on second device and repeat steps 1 to 4 with another account
6. Click `Start Voice Call` or `Start Video Call`
7. Accept on the other device and verify audio/video
8. Use `End Call` to finish

## Fast call-only flow
1. Login (Auto Mode is ON by default)
2. App auto-runs: set online, connect socket, discover IDs, fill target fields
3. Click Start Voice Call or Start Video Call
4. Accept incoming call on second device (or enable auto-accept)

## Auto-first behavior
- Auto Mode after login is enabled by default
- `Auto Discover IDs` fetches likely user IDs from backend endpoints and fills call/chat/profile IDs
- `Auto Fill Comment/Post IDs` uses discovered reference IDs for comment testing
- Manual entry is still supported and takes priority when you type values

## Mobile testing
- Open deployed URL on both phones
- Grant microphone/camera permissions
- Keep phone screen on during call tests
- For clean testing, use two different user accounts
- For live call testing on phones, use HTTPS (Vercel URL). Most phone browsers block camera/mic on plain HTTP.

## Localhost testing guidance
- Desktop localhost works: `http://localhost:4173`
- If you need another phone to open your local build, use your PC LAN IP (for example `http://192.168.1.10:4173`)
- For phone call media permissions, prefer the Vercel HTTPS deployment

## Notes
- IDs must be integer values
- If token expires, login again
- Browser cannot emulate native FCM behavior exactly; call/message socket testing works
- For HTTPS media permission in production, use Vercel deployed URL (https)
