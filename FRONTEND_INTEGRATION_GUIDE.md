# 🚀 Frontend Integration Guide: Login, Chat & Calling

This guide provides the necessary endpoints, payloads, and socket events for integrating the **Login, Chat, and Call** systems into the mobile/web frontend.

---

## 🔐 1. Authentication (Login)

Use this flow to authenticate users and obtain the JWT Bearer token needed for all other requests.

### Login with Mobile & Password
**Endpoint**: `POST /api/v1/auth/login-password`
**Body**:
```json
{
  "mobile_number": "7668564061",
  "password": "yourpassword"
}
```
**Success Response**:
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": 42,
    "full_name": "John Doe",
    "username": "johndoe"
  }
}
```
> [!IMPORTANT]
> Include the token in every request header: `Authorization: Bearer <token>`

---

## 💬 2. Real-time Chat (Socket.IO)

The chat system uses **Socket.IO** for real-time messaging and status updates.

### 🔌 Socket Connection
Connect to the server and authenticate using the token.
```javascript
const socket = io("https://your-domain.com", {
  auth: { token: "your_jwt_token" }
});
```

### 📤 Sending a Message
**Socket Event**: `chat:message`
```json
{
  "receiverId": 43,
  "content": "Hello bro!",
  "type": "text"
}
```

### 📥 Receiving a Message
**Listen for**: `new_message`
```json
{
  "id": 1001,
  "sender_id": 43,
  "content": "Hello bro!",
  "type": "text",
  "created_at": "2026-04-25T12:00:00Z"
}
```

### ✅ Message Ticks (Sent/Delivered/Read)
| Status | Event to Listen For | Logic |
| :--- | :--- | :--- |
| **Delivered** | `message_delivered_receipt` | Update status to "Double Gray Ticks" |
| **Read** | `message_read_receipt` | Update status to "Double Blue Ticks" |

---

## 📞 3. Calling System (WebRTC)

The calling system relies on socket signaling to bridge two users.

### 🔔 3.1 Initiating a Call
**Socket Event**: `call:start`
```json
{
  "targetUserId": 43,
  "callType": "voice", 
  "source": "gt" 
}
```
- **Response `call:initiated`**: Sent to the caller to confirm the ring has started.
- **Response `call:incoming`**: Sent to the receiver to show the incoming call screen.

### 📥 3.2 Incoming Call (Receiver)
Listen for the `call:incoming` event.
```json
{
  "callerId": 42,
  "callType": "voice",
  "source": "gt"
}
```

### ✅ 3.3 Accepting/Rejecting
- **Accept**: Emit `call:accept` with `{ callerId: 42 }`. You will then receive a `call:accepted` event to start WebRTC.
- **Reject**: Emit `call:reject` with `{ callerId: 42 }`.

### 📡 3.4 WebRTC Relay (The "Bridge")
Once a call is accepted, relay these events to establish the media path:
1. `call:offer` / `call:answer`: Relays SDP data.
2. `call:ice`: Relays network candidates. **Only relay to the paired partner.**

### 🔚 3.5 Ending a Call
**Socket Event**: `call:end`
```json
{
  "targetUserId": 43,
  "duration": 60 
}
```
**Listen for `call:ended`**: This event is sent to **both** users when a call finishes (timeout, hangup, or insufficient balance).

---

## 🛡️ 4. Badge & Unread Sync
The server automatically sends the latest unread counts to keep the UI badges accurate.

**Listen for**: `sync_unread_counts`
```json
{
  "unread_chat_messages": 5,
  "unread_notifications": 2,
  "unread_missed_calls": 1,
  "total_badge_count": 8
}
```

---

## 💡 Pro-Tips for Frontend
1. **Room Joining**: On connection, the server automatically joins you to a room named `user_<id>`. You don't need to join it manually.
2. **Timestamps**: All timestamps are handled by the database (`CURRENT_TIMESTAMP`). Trust the server's response order for sorting.
3. **FCM Fallback**: If the socket is disconnected, the server automatically sends an **FCM (Firebase)** notification for incoming calls and messages.
