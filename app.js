/* global io */

const state = {
  apiBaseUrl: "https://genztalkapp.com/api/v1",
  socketUrl: "https://genztalkapp.com",
  token: "",
  user: null,
  autoMode: true,
  discoveredUserIds: [],
  discoveredReferenceIds: [],
  socket: null,
  activeCall: null,
  incomingCall: null,
  pc: null,
  callerOfferTimeoutId: null,
  receiverOfferRetryTimeoutId: null,
  localStream: null,
  remoteStream: null,
  startedAtMs: 0,
};

const dom = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  socketUrl: document.getElementById("socketUrl"),
  saveEnvBtn: document.getElementById("saveEnvBtn"),

  mobileNumber: document.getElementById("mobileNumber"),
  password: document.getElementById("password"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  autoModeEnabled: document.getElementById("autoModeEnabled"),
  authMeta: document.getElementById("authMeta"),
  autoMeta: document.getElementById("autoMeta"),

  socketConnectBtn: document.getElementById("socketConnectBtn"),
  socketDisconnectBtn: document.getElementById("socketDisconnectBtn"),
  socketMeta: document.getElementById("socketMeta"),

  badgeChat: document.getElementById("badgeChat"),
  badgeNotif: document.getElementById("badgeNotif"),
  badgeMissed: document.getElementById("badgeMissed"),
  badgeTotal: document.getElementById("badgeTotal"),

  apiMethod: document.getElementById("apiMethod"),
  apiPath: document.getElementById("apiPath"),
  apiBody: document.getElementById("apiBody"),
  runApiBtn: document.getElementById("runApiBtn"),
  apiResult: document.getElementById("apiResult"),

  profileUserId: document.getElementById("profileUserId"),
  availabilitySelect: document.getElementById("availabilitySelect"),
  fetchProfileBtn: document.getElementById("fetchProfileBtn"),
  fetchFavsBtn: document.getElementById("fetchFavsBtn"),
  setAvailabilityBtn: document.getElementById("setAvailabilityBtn"),
  autoDiscoverBtn: document.getElementById("autoDiscoverBtn"),
  presenceResult: document.getElementById("presenceResult"),

  chatReceiverId: document.getElementById("chatReceiverId"),
  chatType: document.getElementById("chatType"),
  chatMessage: document.getElementById("chatMessage"),
  sendChatBtn: document.getElementById("sendChatBtn"),
  markReadBtn: document.getElementById("markReadBtn"),
  chatTimeline: document.getElementById("chatTimeline"),

  postId: document.getElementById("postId"),
  commentId: document.getElementById("commentId"),
  parentCommentId: document.getElementById("parentCommentId"),
  commentContent: document.getElementById("commentContent"),
  createCommentBtn: document.getElementById("createCommentBtn"),
  likeCommentBtn: document.getElementById("likeCommentBtn"),
  fetchRepliesBtn: document.getElementById("fetchRepliesBtn"),
  autoFillCommentIdsBtn: document.getElementById("autoFillCommentIdsBtn"),
  commentResult: document.getElementById("commentResult"),

  callTargetId: document.getElementById("callTargetId"),
  callType: document.getElementById("callType"),
  quickSetupCallBtn: document.getElementById("quickSetupCallBtn"),
  startVoiceCallBtn: document.getElementById("startVoiceCallBtn"),
  startVideoCallBtn: document.getElementById("startVideoCallBtn"),
  startCallBtn: document.getElementById("startCallBtn"),
  endCallBtn: document.getElementById("endCallBtn"),
  incomingCallBox: document.getElementById("incomingCallBox"),
  incomingText: document.getElementById("incomingText"),
  autoAcceptCalls: document.getElementById("autoAcceptCalls"),
  acceptCallBtn: document.getElementById("acceptCallBtn"),
  rejectCallBtn: document.getElementById("rejectCallBtn"),
  callMeta: document.getElementById("callMeta"),
  localVideo: document.getElementById("localVideo"),
  remoteVideo: document.getElementById("remoteVideo"),

  clearLogBtn: document.getElementById("clearLogBtn"),
  eventLog: document.getElementById("eventLog"),
};

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function log(message, data) {
  const now = new Date().toISOString();
  const line = data
    ? `[${now}] ${message} ${JSON.stringify(data)}`
    : `[${now}] ${message}`;
  dom.eventLog.textContent = `${line}\n${dom.eventLog.textContent}`.trim();
}

function toInt(value, label) {
  const intVal = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(intVal)) {
    throw new Error(`${label} must be an integer`);
  }
  return intVal;
}

function setMeta(el, text) {
  el.textContent = text;
}

function updateAuthMeta() {
  if (!state.token || !state.user) {
    setMeta(dom.authMeta, "Not logged in");
    return;
  }
  const tokenPreview = `${state.token.slice(0, 16)}...`;
  setMeta(
    dom.authMeta,
    `Logged in: ${state.user.full_name || state.user.username || "User"} (id ${state.user.id}) | token ${tokenPreview}`
  );
}

function updateSocketMeta(text) {
  setMeta(dom.socketMeta, `Socket: ${text}`);
}

function safeJsonParse(raw, fallback = {}) {
  if (!raw || !raw.trim()) return fallback;
  return JSON.parse(raw);
}

function getStorage() {
  return {
    apiBaseUrl: localStorage.getItem("tester_api_base_url") || state.apiBaseUrl,
    socketUrl: localStorage.getItem("tester_socket_url") || state.socketUrl,
    token: localStorage.getItem("tester_token") || "",
    user: safeJsonParse(localStorage.getItem("tester_user") || "", null),
    autoMode: (localStorage.getItem("tester_auto_mode") || "true") !== "false",
  };
}

function saveStorage() {
  localStorage.setItem("tester_api_base_url", state.apiBaseUrl);
  localStorage.setItem("tester_socket_url", state.socketUrl);
  if (state.token) {
    localStorage.setItem("tester_token", state.token);
  } else {
    localStorage.removeItem("tester_token");
  }
  if (state.user) {
    localStorage.setItem("tester_user", JSON.stringify(state.user));
  } else {
    localStorage.removeItem("tester_user");
  }
  localStorage.setItem("tester_auto_mode", String(state.autoMode));
}

function loadStateFromStorage() {
  const s = getStorage();
  state.apiBaseUrl = s.apiBaseUrl;
  state.socketUrl = s.socketUrl;
  state.token = s.token;
  state.user = s.user;
  state.autoMode = s.autoMode;

  dom.apiBaseUrl.value = state.apiBaseUrl;
  dom.socketUrl.value = state.socketUrl;
  dom.autoModeEnabled.checked = state.autoMode;
  updateAuthMeta();
}

function updateAutoMeta(text) {
  dom.autoMeta.textContent = text;
}

function parseIntIfAny(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectArraysFromPayload(payload) {
  if (!payload || typeof payload !== "object") return [];

  const arrays = [];
  const possible = [
    payload,
    payload.data,
    payload.users,
    payload.favs,
    payload.waitlist,
    payload.notifications,
    payload.items,
  ];

  possible.forEach((entry) => {
    if (Array.isArray(entry)) arrays.push(entry);
  });

  return arrays;
}

function addUserIdsFromRecord(record, bag) {
  if (!record || typeof record !== "object") return;

  const directUserIdKeys = [
    "user_id",
    "creator_id",
    "sender_id",
    "receiver_id",
    "callerId",
    "targetUserId",
  ];

  directUserIdKeys.forEach((key) => {
    const id = parseIntIfAny(record[key]);
    if (id) bag.add(id);
  });

  const looksLikeUserObject =
    "username" in record ||
    "full_name" in record ||
    "mobile_number" in record ||
    "availability_status" in record ||
    "is_on_waitlist" in record;

  if (looksLikeUserObject) {
    const id = parseIntIfAny(record.id);
    if (id) bag.add(id);
  }
}

function collectUserIdsFromPayload(payload, bag) {
  collectArraysFromPayload(payload).forEach((arr) => {
    arr.forEach((item) => addUserIdsFromRecord(item, bag));
  });

  if (payload && typeof payload === "object") {
    addUserIdsFromRecord(payload.user, bag);
  }
}

function collectReferenceIdsFromPayload(payload, bag) {
  collectArraysFromPayload(payload).forEach((arr) => {
    arr.forEach((item) => {
      const id = parseIntIfAny(item?.reference_id);
      if (id) bag.add(id);
    });
  });
}

function getFieldIntOrNull(el) {
  const raw = String(el.value || "").trim();
  if (!raw) return null;
  return parseIntIfAny(raw);
}

function findBestTargetUserId() {
  const manual =
    getFieldIntOrNull(dom.callTargetId) ||
    getFieldIntOrNull(dom.chatReceiverId) ||
    getFieldIntOrNull(dom.profileUserId);
  if (manual) return manual;

  const discovered = state.discoveredUserIds.find((id) => id !== state.user?.id);
  return discovered || null;
}

function applyAutoTargets() {
  const best = findBestTargetUserId();
  if (best) {
    if (!dom.callTargetId.value.trim()) dom.callTargetId.value = String(best);
    if (!dom.chatReceiverId.value.trim()) dom.chatReceiverId.value = String(best);
    if (!dom.profileUserId.value.trim()) dom.profileUserId.value = String(best);
  }

  const refId = state.discoveredReferenceIds[0];
  if (refId) {
    if (!dom.commentId.value.trim()) dom.commentId.value = String(refId);
    if (!dom.postId.value.trim()) dom.postId.value = String(refId);
  }
}

function buildUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${state.apiBaseUrl}${cleanPath}`;
}

async function apiRequest(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const req = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "DELETE") {
    req.body = JSON.stringify(body || {});
  }

  const response = await fetch(buildUrl(path), req);
  let payload;
  try {
    payload = await response.json();
  } catch (_err) {
    payload = { raw: await response.text() };
  }
  return { ok: response.ok, status: response.status, payload };
}

async function login() {
  const mobile_number = dom.mobileNumber.value.trim();
  const password = dom.password.value;

  if (!mobile_number || !password) {
    throw new Error("Mobile number and password are required");
  }

  const { ok, status, payload } = await apiRequest(
    "POST",
    "/auth/login-password",
    { mobile_number, password }
  );

  if (!ok) {
    throw new Error(`Login failed (${status}): ${JSON.stringify(payload)}`);
  }

  const token = payload.token || payload?.data?.token;
  const user = payload.user || payload?.data?.user;

  if (!token || !user) {
    throw new Error("Login response does not include token/user");
  }

  state.token = token;
  state.user = user;
  saveStorage();
  updateAuthMeta();
  log("Login successful", { userId: user.id });

  if (state.autoMode) {
    try {
      await runAutoSetup();
    } catch (error) {
      updateAutoMeta(`Auto mode partial: ${error.message}`);
      log("Auto mode setup failed", { message: error.message });
    }
  }
}

function logout() {
  state.token = "";
  state.user = null;
  state.discoveredUserIds = [];
  state.discoveredReferenceIds = [];
  saveStorage();
  updateAuthMeta();
  updateAutoMeta("Auto mode ready");
  disconnectSocket();
  endCallCleanup("Logged out");
  log("Logged out");
}

function renderApiResult(result) {
  dom.apiResult.textContent = JSON.stringify(result, null, 2);
}

function renderPresenceResult(result) {
  dom.presenceResult.textContent = JSON.stringify(result, null, 2);
}

function renderCommentResult(result) {
  dom.commentResult.textContent = JSON.stringify(result, null, 2);
}

async function runApiTester() {
  const method = dom.apiMethod.value;
  const path = dom.apiPath.value.trim();
  if (!path) throw new Error("Path is required");

  let body = {};
  if (method !== "GET" && method !== "DELETE") {
    body = safeJsonParse(dom.apiBody.value, {});
  }

  const result = await apiRequest(method, path, body);
  renderApiResult(result);
  log("API request", { method, path, status: result.status });
}

async function fetchProfile() {
  const userId =
    getFieldIntOrNull(dom.profileUserId) ||
    findBestTargetUserId();
  if (!userId) {
    throw new Error("No profile user ID found. Use Auto Discover IDs or enter manually");
  }
  dom.profileUserId.value = String(userId);
  const result = await apiRequest("GET", `/user/profile/${userId}`);
  const bag = new Set(state.discoveredUserIds);
  collectUserIdsFromPayload(result.payload, bag);
  state.discoveredUserIds = Array.from(bag).filter((id) => id !== state.user?.id).slice(0, 30);
  applyAutoTargets();
  renderPresenceResult(result);
  log("profile fetched", { userId, status: result.status });
}

async function fetchFavCreators() {
  let result = await apiRequest("GET", "/user/favs");
  if (!result.ok && result.status === 404) {
    result = await apiRequest("GET", "/user/search/fav");
  }
  const bag = new Set(state.discoveredUserIds);
  collectUserIdsFromPayload(result.payload, bag);
  state.discoveredUserIds = Array.from(bag).filter((id) => id !== state.user?.id).slice(0, 30);
  applyAutoTargets();
  renderPresenceResult(result);
  log("favs fetched", { status: result.status });
}

async function discoverTargets() {
  if (!state.token) {
    throw new Error("Login first before auto discovery");
  }

  const idBag = new Set();
  const refBag = new Set();

  const endpoints = [
    { method: "GET", path: "/user/favs", users: true, refs: false },
    { method: "GET", path: "/user/search/fav", users: true, refs: false },
    { method: "GET", path: "/user/waitlist/my-waiters", users: true, refs: false },
    { method: "GET", path: "/notification", users: true, refs: true },
  ];

  for (const endpoint of endpoints) {
    try {
      const result = await apiRequest(endpoint.method, endpoint.path);
      if (!result.ok) continue;

      if (endpoint.users) {
        collectUserIdsFromPayload(result.payload, idBag);
      }

      if (endpoint.refs) {
        collectReferenceIdsFromPayload(result.payload, refBag);
      }
    } catch (_error) {
      // Keep discovery best-effort; endpoint availability differs per role.
    }
  }

  state.discoveredUserIds = Array.from(idBag)
    .filter((id) => id !== state.user?.id)
    .slice(0, 30);
  state.discoveredReferenceIds = Array.from(refBag).slice(0, 30);
  applyAutoTargets();

  updateAutoMeta(
    `Auto IDs: users ${state.discoveredUserIds.length}, refs ${state.discoveredReferenceIds.length}`
  );
  log("auto discovery completed", {
    userCandidates: state.discoveredUserIds.slice(0, 10),
    refCandidates: state.discoveredReferenceIds.slice(0, 10),
  });
}

async function runAutoSetup() {
  if (!state.token) {
    return;
  }

  updateAutoMeta("Auto mode running...");
  await quickSetupForCalling();
  await discoverTargets();
  applyAutoTargets();
  updateAutoMeta("Auto mode completed");
}

async function setMyAvailability() {
  const status = dom.availabilitySelect.value;
  const result = await apiRequest("POST", "/user/availability", { status });
  renderPresenceResult(result);
  log("availability updated", { status, httpStatus: result.status });
}

function appendChatItem(title, payload) {
  const li = document.createElement("li");
  const short = document.createElement("div");
  short.textContent = title;
  const small = document.createElement("div");
  small.className = "small";
  small.textContent = JSON.stringify(payload);
  li.append(short, small);
  dom.chatTimeline.prepend(li);
}

function ensureSocket() {
  if (state.socket) return state.socket;
  if (!state.token) {
    throw new Error("Login first to connect socket");
  }

  const socket = io(state.socketUrl, {
    auth: { token: state.token },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    updateSocketMeta(`connected (${socket.id})`);
    log("Socket connected", { socketId: socket.id });
  });

  socket.on("disconnect", (reason) => {
    updateSocketMeta(`disconnected (${reason})`);
    log("Socket disconnected", { reason });
  });

  socket.on("connect_error", (err) => {
    updateSocketMeta(`error (${err.message})`);
    log("Socket error", { message: err.message });
  });

  socket.on("new_message", (payload) => {
    appendChatItem("Incoming message", payload);
    log("new_message", payload);
  });

  socket.on("message_delivered_receipt", (payload) => {
    appendChatItem("Delivered receipt", payload);
    log("message_delivered_receipt", payload);
  });

  socket.on("message_read_receipt", (payload) => {
    appendChatItem("Read receipt", payload);
    log("message_read_receipt", payload);
  });

  socket.on("sync_unread_counts", (payload) => {
    dom.badgeChat.textContent = String(payload.unread_chat_messages || 0);
    dom.badgeNotif.textContent = String(payload.unread_notifications || 0);
    dom.badgeMissed.textContent = String(payload.unread_missed_calls || 0);
    dom.badgeTotal.textContent = String(payload.total_badge_count || 0);
    log("sync_unread_counts", payload);
  });

  socket.on("call:incoming", onIncomingCall);
  socket.on("call:initiated", (payload) => {
    log("call:initiated", payload);
    setMeta(dom.callMeta, "Call: ringing target");
  });
  socket.on("call:accept", onCallAccepted);
  socket.on("call:accepted", onCallAccepted);
  socket.on("call:offer", onCallOffer);
  socket.on("call:answer", onCallAnswer);
  socket.on("call:ice", onCallIce);
  socket.on("call:ended", (payload) => {
    log("call:ended", payload);
    endCallCleanup("Call ended by server/peer");
  });
  socket.on("call:reject", (payload) => {
    log("call:reject", payload);
    endCallCleanup("Call rejected");
  });

  state.socket = socket;
  return socket;
}

function disconnectSocket() {
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  updateSocketMeta("disconnected");
}

function emit(eventName, payload) {
  const socket = ensureSocket();
  socket.emit(eventName, payload);
  log(`emit ${eventName}`, payload);
}

function extractPartnerId(payload) {
  const keys = [
    "targetUserId",
    "receiverId",
    "callerId",
    "acceptedBy",
    "endedBy",
    "fromUserId",
    "senderId",
    "userId",
  ];
  for (const key of keys) {
    if (payload && payload[key] !== undefined && payload[key] !== null) {
      const parsed = Number.parseInt(payload[key], 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getOfferFromPayload(payload) {
  return payload.offer || payload.sdp || payload.data?.offer || payload;
}

function getAnswerFromPayload(payload) {
  return payload.answer || payload.sdp || payload.data?.answer || payload;
}

function getIceCandidateFromPayload(payload) {
  return payload.candidate || payload.ice || payload.data?.candidate || null;
}

function clearCallTimers() {
  if (state.callerOfferTimeoutId) {
    clearTimeout(state.callerOfferTimeoutId);
    state.callerOfferTimeoutId = null;
  }

  if (state.receiverOfferRetryTimeoutId) {
    clearTimeout(state.receiverOfferRetryTimeoutId);
    state.receiverOfferRetryTimeoutId = null;
  }
}

async function sendOfferToPartner(reason) {
  if (!state.activeCall || state.activeCall.role !== "caller") {
    return;
  }

  if (state.activeCall.offerSent) {
    return;
  }

  const partnerId = state.activeCall.partnerUserId;
  if (!partnerId) {
    log("offer skipped - missing partner id", { reason });
    return;
  }

  const pc = await createPeerConnection(state.activeCall.callType || "voice");

  if (pc.localDescription) {
    state.activeCall.offerSent = true;
    return;
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  emit("call:offer", {
    targetUserId: partnerId,
    offer,
  });

  state.activeCall.offerSent = true;
  setMeta(dom.callMeta, `Call: offer sent (${reason})`);
}

async function ensureMedia(callType) {
  if (state.localStream) return state.localStream;
  const constraints =
    callType === "video"
      ? { audio: true, video: { facingMode: "user" } }
      : { audio: true, video: false };
  state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
  dom.localVideo.srcObject = state.localStream;
  return state.localStream;
}

async function createPeerConnection(callType) {
  if (state.pc) return state.pc;

  const stream = await ensureMedia(callType);
  const pc = new RTCPeerConnection(ICE_SERVERS);

  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  state.remoteStream = new MediaStream();
  dom.remoteVideo.srcObject = state.remoteStream;

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      state.remoteStream.addTrack(track);
    });
  };

  pc.onicecandidate = (event) => {
    if (!event.candidate || !state.activeCall?.partnerUserId) return;
    emit("call:ice", {
      targetUserId: state.activeCall.partnerUserId,
      candidate: event.candidate,
    });
  };

  pc.onconnectionstatechange = () => {
    setMeta(dom.callMeta, `Call: ${pc.connectionState}`);
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      endCallCleanup(`Peer connection ${pc.connectionState}`);
    }
  };

  state.pc = pc;
  return pc;
}

function resetIncomingCallUI() {
  state.incomingCall = null;
  dom.incomingText.textContent = "Incoming call...";
  dom.incomingCallBox.classList.add("hidden");
}

function showIncomingCall(callerId, callType) {
  dom.incomingText.textContent = `Incoming ${callType} call from user ${callerId}`;
  dom.incomingCallBox.classList.remove("hidden");
}

async function startCall() {
  const targetUserId = findBestTargetUserId();
  if (!targetUserId) {
    throw new Error("No target user ID found. Use Auto Discover IDs or enter manually");
  }
  dom.callTargetId.value = String(targetUserId);
  const callType = dom.callType.value;

  state.activeCall = {
    role: "caller",
    partnerUserId: targetUserId,
    callType,
    offerSent: false,
  };
  state.startedAtMs = Date.now();

  setMeta(dom.callMeta, `Call: initiating ${callType} to user ${targetUserId}`);
  emit("call:start", { targetUserId, callType, source: "gt" });

  if (state.callerOfferTimeoutId) {
    clearTimeout(state.callerOfferTimeoutId);
  }

  state.callerOfferTimeoutId = setTimeout(() => {
    sendOfferToPartner("fallback-timeout").catch((error) => {
      log("offer fallback failed", { message: error.message });
    });
  }, 4500);
}

async function quickSetupForCalling() {
  if (!state.token) {
    throw new Error("Login first before call setup");
  }

  // Setup helper keeps call testing to a single flow for two-device testing.
  const result = await apiRequest("POST", "/user/availability", { status: "online" });
  if (!result.ok) {
    throw new Error(`Unable to set online status (${result.status})`);
  }

  ensureSocket();
  log("Quick call setup completed", { availability: "online" });
  setMeta(dom.callMeta, "Call: ready (online + socket connected)");
}

async function startCallByType(callType) {
  dom.callType.value = callType;
  await startCall();
}

function onIncomingCall(payload) {
  const callerId = extractPartnerId(payload);
  const callType = payload?.callType || "voice";
  if (!callerId) {
    log("call:incoming ignored - callerId missing", payload);
    return;
  }

  state.incomingCall = {
    callerId,
    callType,
  };

  showIncomingCall(callerId, callType);
  setMeta(dom.callMeta, `Call: incoming ${callType} from user ${callerId}`);
  log("call:incoming", payload);

  if (dom.autoAcceptCalls.checked) {
    acceptCall().catch((error) => {
      log("Auto accept failed", { message: error.message });
    });
  }
}

async function acceptCall() {
  if (!state.incomingCall) {
    throw new Error("No incoming call to accept");
  }

  const { callerId, callType } = state.incomingCall;
  state.activeCall = {
    role: "receiver",
    partnerUserId: callerId,
    callType,
    offerSent: false,
  };
  state.startedAtMs = Date.now();

  emit("call:accept", { callerId });
  await createPeerConnection(callType);

  if (state.receiverOfferRetryTimeoutId) {
    clearTimeout(state.receiverOfferRetryTimeoutId);
  }

  state.receiverOfferRetryTimeoutId = setTimeout(() => {
    emit("call:accept", { callerId });
    log("accept retry sent", { callerId });
  }, 5000);

  resetIncomingCallUI();
  setMeta(dom.callMeta, `Call: accepted, waiting for offer from ${callerId}`);
}

function rejectCall() {
  if (!state.incomingCall) {
    return;
  }
  const { callerId } = state.incomingCall;
  emit("call:reject", { callerId });
  resetIncomingCallUI();
  setMeta(dom.callMeta, "Call: rejected");
}

async function onCallAccepted(payload) {
  log("call:accepted", payload);
  if (state.callerOfferTimeoutId) {
    clearTimeout(state.callerOfferTimeoutId);
    state.callerOfferTimeoutId = null;
  }

  const extractedPartnerId = extractPartnerId(payload);
  const partnerId =
    extractedPartnerId && extractedPartnerId !== state.user?.id
      ? extractedPartnerId
      : state.activeCall?.partnerUserId;

  if (extractedPartnerId && extractedPartnerId === state.user?.id) {
    log("call:accepted payload had self id, keeping existing partner", {
      extractedPartnerId,
      activePartner: state.activeCall?.partnerUserId,
    });
  }

  if (!state.activeCall || !partnerId) {
    log("call:accepted ignored - no active call context", payload);
    return;
  }

  state.activeCall.partnerUserId = partnerId;

  // Caller creates the offer after receiver accepts.
  if (state.activeCall.role === "caller") {
    await sendOfferToPartner("accepted-event");
  }
}

async function onCallOffer(payload) {
  log("call:offer", payload);

  if (state.receiverOfferRetryTimeoutId) {
    clearTimeout(state.receiverOfferRetryTimeoutId);
    state.receiverOfferRetryTimeoutId = null;
  }

  const partnerId = extractPartnerId(payload) || state.activeCall?.partnerUserId;
  const callType =
    payload?.callType || state.activeCall?.callType || state.incomingCall?.callType || "voice";

  if (!partnerId) {
    log("call:offer ignored - partner id missing", payload);
    return;
  }

  if (!state.activeCall) {
    state.activeCall = {
      role: "receiver",
      partnerUserId: partnerId,
      callType,
    };
  }

  const offer = getOfferFromPayload(payload);
  const pc = await createPeerConnection(callType);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  emit("call:answer", {
    targetUserId: partnerId,
    answer,
  });
  setMeta(dom.callMeta, "Call: received offer, sent answer");
}

async function onCallAnswer(payload) {
  log("call:answer", payload);
  if (!state.pc) {
    log("call:answer ignored - peer not ready", payload);
    return;
  }
  const answer = getAnswerFromPayload(payload);
  await state.pc.setRemoteDescription(new RTCSessionDescription(answer));
  setMeta(dom.callMeta, "Call: answer received, media connecting");
}

async function onCallIce(payload) {
  const candidate = getIceCandidateFromPayload(payload);
  if (!candidate || !state.pc) {
    return;
  }
  try {
    await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    log("call:ice add candidate failed", { message: error.message });
  }
}

function callDurationSecs() {
  if (!state.startedAtMs) return 0;
  return Math.max(1, Math.round((Date.now() - state.startedAtMs) / 1000));
}

function endCall() {
  if (state.activeCall?.partnerUserId) {
    emit("call:end", {
      targetUserId: state.activeCall.partnerUserId,
      duration: callDurationSecs(),
    });
  }
  endCallCleanup("Call ended by self");
}

function stopMedia() {
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
    state.localStream = null;
  }
  if (state.remoteStream) {
    state.remoteStream.getTracks().forEach((track) => track.stop());
    state.remoteStream = null;
  }
  dom.localVideo.srcObject = null;
  dom.remoteVideo.srcObject = null;
}

function endCallCleanup(reason) {
  clearCallTimers();

  if (state.pc) {
    state.pc.onicecandidate = null;
    state.pc.ontrack = null;
    state.pc.close();
    state.pc = null;
  }
  stopMedia();
  state.activeCall = null;
  state.startedAtMs = 0;
  resetIncomingCallUI();
  setMeta(dom.callMeta, `Call: idle (${reason})`);
  log("call_cleanup", { reason });
}

function sendChatMessage() {
  const receiverId =
    getFieldIntOrNull(dom.chatReceiverId) ||
    findBestTargetUserId();
  if (!receiverId) {
    throw new Error("No receiver ID found. Use Auto Discover IDs or enter manually");
  }
  dom.chatReceiverId.value = String(receiverId);
  const content = dom.chatMessage.value.trim();
  const type = dom.chatType.value;
  if (!content) throw new Error("Message is required");

  emit("chat:message", { receiverId, content, type });
  appendChatItem("Outgoing message", { receiverId, content, type });
  dom.chatMessage.value = "";
}

function emitReadReceipt() {
  const receiverId =
    getFieldIntOrNull(dom.chatReceiverId) ||
    findBestTargetUserId();
  if (!receiverId) {
    throw new Error("No receiver ID found. Use Auto Discover IDs or enter manually");
  }
  dom.chatReceiverId.value = String(receiverId);
  emit("message_read", { userId: receiverId });
}

async function createCommentOrReply() {
  const postId =
    getFieldIntOrNull(dom.postId) ||
    state.discoveredReferenceIds[0] ||
    null;
  if (!postId) {
    throw new Error("No post ID found. Use Auto Fill Comment/Post IDs or enter manually");
  }
  dom.postId.value = String(postId);
  const content = dom.commentContent.value.trim();
  if (!content) {
    throw new Error("Comment content is required");
  }

  const parentRaw = dom.parentCommentId.value.trim();
  const parent_id = parentRaw ? toInt(parentRaw, "Parent comment ID") : null;

  const result = await apiRequest("POST", `/post/${postId}/comment`, {
    content,
    parent_id,
  });

  renderCommentResult(result);
  log("comment create/reply", { postId, parent_id, status: result.status });
}

async function likeComment() {
  const commentId =
    getFieldIntOrNull(dom.commentId) ||
    state.discoveredReferenceIds[0] ||
    null;
  if (!commentId) {
    throw new Error("No comment ID found. Use Auto Fill Comment/Post IDs or enter manually");
  }
  dom.commentId.value = String(commentId);
  const result = await apiRequest("POST", `/post/comment/${commentId}/like`, {});
  renderCommentResult(result);
  log("comment liked", { commentId, status: result.status });
}

async function fetchCommentReplies() {
  const commentId =
    getFieldIntOrNull(dom.commentId) ||
    state.discoveredReferenceIds[0] ||
    null;
  if (!commentId) {
    throw new Error("No comment ID found. Use Auto Fill Comment/Post IDs or enter manually");
  }
  dom.commentId.value = String(commentId);
  const result = await apiRequest("GET", `/post/comment/${commentId}/replies`);
  renderCommentResult(result);
  log("comment replies fetched", { commentId, status: result.status });
}

function autoFillCommentIds() {
  const refId = state.discoveredReferenceIds[0] || null;
  if (!refId) {
    throw new Error("No discovered comment/post ID yet. Click Auto Discover IDs first");
  }
  if (!dom.commentId.value.trim()) dom.commentId.value = String(refId);
  if (!dom.postId.value.trim()) dom.postId.value = String(refId);
  log("comment/post IDs auto-filled", { refId });
}

function wireQuickApiButtons() {
  document.querySelectorAll(".quick-api").forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.apiMethod.value = btn.dataset.method || "GET";
      dom.apiPath.value = btn.dataset.path || "/";
      dom.apiBody.value = btn.dataset.body || "";
    });
  });
}

function bindEvents() {
  dom.saveEnvBtn.addEventListener("click", () => {
    state.apiBaseUrl = dom.apiBaseUrl.value.trim().replace(/\/$/, "");
    state.socketUrl = dom.socketUrl.value.trim().replace(/\/$/, "");
    saveStorage();
    log("Environment saved", {
      apiBaseUrl: state.apiBaseUrl,
      socketUrl: state.socketUrl,
    });
  });

  dom.loginBtn.addEventListener("click", async () => {
    try {
      await login();
    } catch (error) {
      log("Login failed", { message: error.message });
      alert(error.message);
    }
  });

  dom.logoutBtn.addEventListener("click", logout);

  dom.autoModeEnabled.addEventListener("change", () => {
    state.autoMode = dom.autoModeEnabled.checked;
    saveStorage();
    updateAutoMeta(state.autoMode ? "Auto mode enabled" : "Auto mode disabled");
  });

  dom.runApiBtn.addEventListener("click", async () => {
    try {
      await runApiTester();
    } catch (error) {
      log("API error", { message: error.message });
      renderApiResult({ error: error.message });
    }
  });

  dom.fetchProfileBtn.addEventListener("click", async () => {
    try {
      await fetchProfile();
    } catch (error) {
      renderPresenceResult({ error: error.message });
      log("fetch profile failed", { message: error.message });
    }
  });

  dom.fetchFavsBtn.addEventListener("click", async () => {
    try {
      await fetchFavCreators();
    } catch (error) {
      renderPresenceResult({ error: error.message });
      log("fetch favs failed", { message: error.message });
    }
  });

  dom.setAvailabilityBtn.addEventListener("click", async () => {
    try {
      await setMyAvailability();
    } catch (error) {
      renderPresenceResult({ error: error.message });
      log("set availability failed", { message: error.message });
    }
  });

  dom.autoDiscoverBtn.addEventListener("click", async () => {
    try {
      await discoverTargets();
      renderPresenceResult({
        discoveredUserIds: state.discoveredUserIds,
        discoveredReferenceIds: state.discoveredReferenceIds,
      });
    } catch (error) {
      renderPresenceResult({ error: error.message });
      log("auto discovery failed", { message: error.message });
    }
  });

  dom.socketConnectBtn.addEventListener("click", () => {
    try {
      ensureSocket();
    } catch (error) {
      alert(error.message);
    }
  });

  dom.socketDisconnectBtn.addEventListener("click", () => {
    disconnectSocket();
    endCallCleanup("Socket disconnected");
  });

  dom.sendChatBtn.addEventListener("click", () => {
    try {
      sendChatMessage();
    } catch (error) {
      alert(error.message);
    }
  });

  dom.markReadBtn.addEventListener("click", () => {
    try {
      emitReadReceipt();
    } catch (error) {
      alert(error.message);
    }
  });

  dom.createCommentBtn.addEventListener("click", async () => {
    try {
      await createCommentOrReply();
    } catch (error) {
      renderCommentResult({ error: error.message });
      log("create comment/reply failed", { message: error.message });
    }
  });

  dom.likeCommentBtn.addEventListener("click", async () => {
    try {
      await likeComment();
    } catch (error) {
      renderCommentResult({ error: error.message });
      log("like comment failed", { message: error.message });
    }
  });

  dom.fetchRepliesBtn.addEventListener("click", async () => {
    try {
      await fetchCommentReplies();
    } catch (error) {
      renderCommentResult({ error: error.message });
      log("fetch replies failed", { message: error.message });
    }
  });

  dom.autoFillCommentIdsBtn.addEventListener("click", () => {
    try {
      autoFillCommentIds();
      renderCommentResult({
        postId: dom.postId.value,
        commentId: dom.commentId.value,
      });
    } catch (error) {
      renderCommentResult({ error: error.message });
      log("auto fill comment IDs failed", { message: error.message });
    }
  });

  dom.startCallBtn.addEventListener("click", async () => {
    try {
      await startCall();
    } catch (error) {
      alert(error.message);
      log("Start call failed", { message: error.message });
    }
  });

  dom.quickSetupCallBtn.addEventListener("click", async () => {
    try {
      await quickSetupForCalling();
    } catch (error) {
      alert(error.message);
      log("Quick call setup failed", { message: error.message });
    }
  });

  dom.startVoiceCallBtn.addEventListener("click", async () => {
    try {
      await startCallByType("voice");
    } catch (error) {
      alert(error.message);
      log("Start voice call failed", { message: error.message });
    }
  });

  dom.startVideoCallBtn.addEventListener("click", async () => {
    try {
      await startCallByType("video");
    } catch (error) {
      alert(error.message);
      log("Start video call failed", { message: error.message });
    }
  });

  dom.acceptCallBtn.addEventListener("click", async () => {
    try {
      await acceptCall();
    } catch (error) {
      alert(error.message);
      log("Accept call failed", { message: error.message });
    }
  });

  dom.rejectCallBtn.addEventListener("click", () => {
    try {
      rejectCall();
    } catch (error) {
      alert(error.message);
    }
  });

  dom.endCallBtn.addEventListener("click", () => {
    try {
      endCall();
    } catch (error) {
      alert(error.message);
    }
  });

  dom.clearLogBtn.addEventListener("click", () => {
    dom.eventLog.textContent = "";
  });
}

function bootstrap() {
  loadStateFromStorage();
  wireQuickApiButtons();
  bindEvents();
  updateSocketMeta("disconnected");
  updateAutoMeta(state.autoMode ? "Auto mode enabled" : "Auto mode disabled");
  setMeta(dom.callMeta, "Call: idle");
  log("App booted");

  if (state.token && state.autoMode) {
    runAutoSetup().catch((error) => {
      updateAutoMeta(`Auto mode partial: ${error.message}`);
      log("Auto mode startup failed", { message: error.message });
    });
  }
}

bootstrap();
