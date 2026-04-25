# GEN-Z API: Deep Technical Architecture & Fixes Log

This document provides a comprehensive breakdown of the system for developers. It covers the logic behind the recent fixes, the routing architecture, and how the mobile app should interact with the server.

---

## 📂 1. Directory & Routing Architecture

Understanding where code lives is critical for debugging:

*   **`/src/config/`**: Contains core configurations.
    - `db.js`: Database connection pool.
    - `socket.js`: Real-time calling, billing pulses, and WebRTC signaling logic.
*   **`/src/modules/`**: The heart of the business logic.
    - `/user/`: Profile management, favorites, and waitlists.
    - `/auth/`: JWT-based login and registration.
    - `/admin/`: Dashboard APIs for monitoring and management.
*   **`/admin/`**: The React (Vite) project for the Admin Dashboard.
    - `/src/`: Source code.
    - `/dist/`: **CRITICAL** - This folder contains the built files served to the web.

### 🛣️ How a Route is Hit:
1.  A request comes to `index.js`.
2.  It is passed to `src/modules/index.js` which branches out to `user`, `auth`, or `admin` routes.
3.  Each route file (e.g., `user.routes.js`) applies `authMiddleware` to secure the endpoint.
4.  The controller file (e.g., `user.controller.js`) executes the SQL and returns JSON.

---

## 🔧 2. Technical Fixes Deep Dive

### A. The Database Authentication Error
*   **The Problem**: The server was failing to connect to MySQL even when the `.env` file had the correct credentials. It kept throwing `Access Denied` or `ECONNREFUSED`.
*   **The Cause**: In `src/config/db.js`, the code was using the Logical OR (`||`) operator for the password: `password: process.env.DB_PASSWORD || "password"`. In JavaScript, if `DB_PASSWORD` is an empty string (`""`), it is considered "falsy", so the code defaults to the string `"password"`. Since your local XAMPP had no password, the connection failed.
*   **The Fix**: Replaced `||` with the **Nullish Coalescing Operator (`??`)**. This operator ONLY uses the default if the value is `null` or `undefined`. It correctly treats an empty string `""` as a valid password.

*   **The Fix**: By fixing the database connection in `db.js`, the billing pulse was able to successfully reach the `wallets` table, allowing calls to continue normally.

### D. Call System Stabilization & Timestamp Fix
*   **The Problem**: Inconsistent "Ringing" states and timezone mismatches (5:30 offset) between the server and mobile clients.
*   **The Fix (Signaling)**: Unified all signaling rooms to use strictly integer-based IDs (`user_42`) to prevent string/int mismatches. Moved the "Balance Check" to be non-blocking so the receiver's phone starts ringing immediately.
*   **The Fix (Timestamps)**: Removed all manual `new Date()` injections in the backend. The system now uses database `CURRENT_TIMESTAMP` exclusively. This fixed the "future message" and wrong call log time bugs.
*   **The Fix (Badges)**: Updated the unread count logic to include `unread_missed_calls` in the `total_badge_count` so the app icon badge is always 100% accurate.

### C. Admin Panel Feature Reversion (UI & API)
*   **The Problem**: Recently added features ("Add Coins" and "Promote to Creator") needed to be removed to return the system to its original state.
*   **The Fix (API)**: We deleted the routes from `admin.routes.js` and the corresponding logic from `user.admin.controller.js`. This prevents any unauthorized coin manipulation even via tools like Postman.
*   **The Fix (UI)**: We removed the buttons from `UserDetailModal.jsx`. 
*   **Critical Step**: Because the Admin Panel is a Vite/React app, we had to run `npm run build` to generate a new `dist` folder. The live site serves the `dist` folder, so simply changing the source code was not enough—the build had to be refreshed.

### D. Waitlist Status Awareness (`is_on_waitlist`)
*   **The Problem**: The app didn't know if a user was already in a creator's waitlist, leading to UI confusion where the "Join Waitlist" button would appear even if they were already waiting.
*   **The Fix**: We updated the profile and favorites controllers. Now, when fetching a creator, the server performs a sub-query on the `waitlist` table to check if the `logged_in_user_id` has a "pending" entry for that `creator_id`. It returns a boolean `is_on_waitlist: true/false`.

---

## 📞 3. Real-time Calling Logic (Socket.io)

The mobile app interacts with the server via Sockets for calls:

1.  **Signaling**: The server acts as a relay for `offer`, `answer`, and `call:ice` (WebRTC).
2.  **Billing Pulse**: Once a call state is `active`, the server runs a timer. Every 30-60 seconds, it executes a coin deduction.
3.  **Automatic Termination**: If the balance hits `< rate`, or if the SQL query fails, the server emits `call:ended`.
4.  **Idempotency**: We now use an `endedCallPairs` guard to ensure the `call:ended` signal is sent **exactly once** per session, preventing duplicate UI popups.

---

## 🖼️ 4. Media & URL Handling

The system uses a helper called `MediaProcessor.js` to ensure URLs work on both Local and Production:

*   **Relative Paths**: The database stores paths like `/uploads/avatars/image.jpg`.
*   **URL Normalization**: Before the API sends a response, it runs `MediaProcessor.prepareResponse()`.
*   **Absolute URLs**: This attaches the base domain (e.g., `https://genztalkapp.com`) to the path so the Mobile App can display the image immediately.

---

## ⚠️ 5. Developer "Gotchas" (Must Read)

1.  **Empty Passwords**: If using XAMPP locally with no password, your `.env` must have `DB_PASSWORD=` (empty). The system is now fixed to respect this.
2.  **Integer vs String**: All IDs in database tables are `INT(11)`. Passing a string (UUID) from the app will cause a SQL error.
3.  **Vite Build**: Never forget that the Admin Panel code change requires a rebuild (`cd admin && npm run build`).

---

## 🚀 6. Verification Checklist
If you think the server is down, check these 3 things in order:
1.  **Database**: Is MySQL running in XAMPP?
2.  **Process**: Is the Node.js process running (use `pm2 list` or Hostinger Dashboard)?
3.  **Logs**: Check `logs/err.log` for any "uncaughtException".
