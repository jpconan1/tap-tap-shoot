import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024;
const DEFAULT_MAX_BUFFERED_BYTES = 256 * 1024;
const DEFAULT_HEARTBEAT_MS = 30 * 1000;

export function attachWebSocketServer(server, {
  path = '/ws',
  onConnection,
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxBufferedBytes = DEFAULT_MAX_BUFFERED_BYTES,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  maxConnections = Infinity,
  maxConnectionsPerIp = 25,
  maxConnectionsPerMinute = 30,
  maxMessagesPerSecond = 20,
  trustProxy = false,
  originMode = 'off',
  allowedOrigins = [],
  originSummaryMs = 5 * 60 * 1000,
  onOriginSummary = (summary) => console.log('[ws-origin]', JSON.stringify(summary)),
  now = () => Date.now(),
}) {
  let activeConnections = 0;
  const ipLimiter = createIpConnectionLimiter({
    maxActive: maxConnectionsPerIp,
    maxAttempts: maxConnectionsPerMinute,
    windowMs: 60_000,
    now,
  });
  const cleanupTimer = setInterval(() => ipLimiter.cleanup(), 60_000);
  const originPolicy = createWebSocketOriginPolicy({
    mode: originMode,
    allowedOrigins,
    onSummary: onOriginSummary,
  });
  const originSummaryTimer = originMode !== 'off' && originSummaryMs > 0
    ? setInterval(() => originPolicy.flushSummary(), originSummaryMs)
    : null;
  cleanupTimer.unref?.();
  originSummaryTimer?.unref?.();
  server.on('close', () => {
    clearInterval(cleanupTimer);
    clearInterval(originSummaryTimer);
    originPolicy.flushSummary();
  });

  server.on('upgrade', (request, socket) => {
    if (new URL(request.url, 'http://localhost').pathname !== path) {
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];
    const version = request.headers['sec-websocket-version'];

    if (!key || version !== '13') {
      socket.destroy();
      return;
    }

    const originAdmission = originPolicy.check(request.headers.origin);
    if (!originAdmission.ok) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    if (activeConnections >= maxConnections) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const clientIp = getClientIp(request, { trustProxy });
    const admission = ipLimiter.acquire(clientIp);
    if (!admission.ok) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nRetry-After: 60\r\n\r\n');
      socket.destroy();
      return;
    }

    activeConnections += 1;

    const accept = createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'));

    const connection = createWebSocketConnection(socket, {
      maxMessageBytes,
      maxBufferedBytes,
      heartbeatMs,
      maxMessagesPerSecond,
      now,
      onClose() {
        activeConnections -= 1;
        admission.release();
      },
    });
    onConnection(connection, request);
  });
}

export function createWebSocketOriginPolicy({
  mode = 'off',
  allowedOrigins = [],
  onSummary = () => {},
  maxObservedOrigins = 25,
} = {}) {
  const normalizedMode = ['off', 'report', 'enforce'].includes(mode) ? mode : 'off';
  const allowlist = new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean));
  let counts = createOriginCounts();

  return {
    check(receivedOrigin) {
      if (normalizedMode === 'off') {
        return { ok: true, status: 'off' };
      }

      const origin = normalizeOrigin(Array.isArray(receivedOrigin) ? receivedOrigin[0] : receivedOrigin);
      if (!origin) {
        counts.missing += 1;
        return { ok: true, status: 'missing' };
      }

      if (allowlist.has(origin)) {
        counts.allowed += 1;
        incrementOrigin(counts.origins, origin, maxObservedOrigins);
        return { ok: true, status: 'allowed' };
      }

      counts.wouldReject += 1;
      incrementOrigin(counts.origins, origin, maxObservedOrigins);
      return {
        ok: normalizedMode !== 'enforce',
        status: normalizedMode === 'enforce' ? 'rejected' : 'wouldReject',
      };
    },
    flushSummary() {
      const total = counts.allowed + counts.missing + counts.wouldReject;
      if (total === 0) {
        return null;
      }

      const summary = {
        mode: normalizedMode,
        allowed: counts.allowed,
        missing: counts.missing,
        wouldReject: counts.wouldReject,
        origins: Object.fromEntries(counts.origins),
      };
      counts = createOriginCounts();
      onSummary(summary);
      return summary;
    },
  };
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim() || value === 'null') {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value.trim().slice(0, 200);
  }
}

function createOriginCounts() {
  return { allowed: 0, missing: 0, wouldReject: 0, origins: new Map() };
}

function incrementOrigin(origins, origin, maxObservedOrigins) {
  const key = origins.has(origin) || origins.size < maxObservedOrigins ? origin : '(other)';
  origins.set(key, (origins.get(key) ?? 0) + 1);
}

function createWebSocketConnection(socket, {
  maxMessageBytes,
  maxBufferedBytes,
  heartbeatMs,
  maxMessagesPerSecond,
  now,
  onClose,
}) {
  let buffer = Buffer.alloc(0);
  let alive = true;
  let closed = false;
  const messageListeners = new Set();
  const closeListeners = new Set();
  const messageLimiter = createSlidingWindowLimiter({
    limit: maxMessagesPerSecond,
    windowMs: 1_000,
    now,
  });
  const heartbeat = heartbeatMs > 0
    ? setInterval(() => {
      if (!alive) {
        socket.destroy();
        return;
      }

      alive = false;
      sendFrame(Buffer.alloc(0), 0x9);
    }, heartbeatMs)
    : null;

  heartbeat?.unref?.();

  socket.on('data', (chunk) => {
    try {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length > maxMessageBytes + 14) {
        closeWithCode(1009, 'message too large');
        return;
      }

      const parsed = readFrames(buffer, { maxMessageBytes });
      buffer = parsed.remaining;

      for (const frame of parsed.frames) {
        if (frame.opcode === 0x8) {
          closeWithCode(1000);
          return;
        }

        if (frame.opcode === 0x9) {
          sendFrame(frame.payload, 0xA);
          continue;
        }

        if (frame.opcode === 0xA) {
          alive = true;
          continue;
        }

        if (!messageLimiter.allow()) {
          closeWithCode(1008, 'message rate exceeded');
          return;
        }

        const message = frame.payload.toString('utf8');
        for (const listener of messageListeners) {
          listener(message);
        }
      }
    } catch {
      closeWithCode(1002, 'bad frame');
    }
  });

  socket.on('close', handleClose);
  socket.on('end', handleClose);

  socket.on('error', () => {
    socket.destroy();
  });

  function handleClose() {
    if (closed) {
      return;
    }

    closed = true;
    clearInterval(heartbeat);
    onClose();

    for (const listener of closeListeners) {
      listener();
    }
  }

  function sendFrame(payload, opcode) {
    if (socket.destroyed || socket.writableLength > maxBufferedBytes) {
      socket.destroy();
      return false;
    }

    return socket.write(writeFrame(payload, opcode));
  }

  function closeWithCode(code, reason = '') {
    const reasonBytes = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);

    if (!socket.destroyed) {
      socket.end(writeFrame(payload, 0x8));
    }
  }

  return {
    send(message) {
      const payload = Buffer.from(message, 'utf8');

      if (payload.length > maxMessageBytes) {
        closeWithCode(1009, 'message too large');
        return;
      }

      sendFrame(payload, 0x1);
    },
    close(code = 1000, reason = '') {
      closeWithCode(code, reason);
    },
    onMessage(listener) {
      messageListeners.add(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
    },
  };
}

export function getClientIp(request, { trustProxy = false } = {}) {
  if (trustProxy) {
    const forwarded = request.headers?.['x-forwarded-for'];
    const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
    if (candidate && isIP(candidate)) {
      return candidate;
    }
  }

  return request.socket?.remoteAddress || 'unknown';
}

export function createIpConnectionLimiter({ maxActive, maxAttempts, windowMs, now = () => Date.now() }) {
  const entries = new Map();

  function getEntry(ip) {
    let entry = entries.get(ip);
    if (!entry) {
      entry = { active: 0, attempts: [] };
      entries.set(ip, entry);
    }
    prune(entry);
    return entry;
  }

  function prune(entry) {
    const cutoff = now() - windowMs;
    while (entry.attempts[0] <= cutoff) {
      entry.attempts.shift();
    }
  }

  return {
    acquire(ip) {
      const entry = getEntry(ip);
      if (entry.attempts.length >= maxAttempts) {
        return { ok: false, reason: 'attempts' };
      }
      entry.attempts.push(now());
      if (entry.active >= maxActive) {
        return { ok: false, reason: 'active' };
      }
      entry.active += 1;
      let released = false;
      return {
        ok: true,
        release() {
          if (!released) {
            released = true;
            entry.active = Math.max(0, entry.active - 1);
          }
        },
      };
    },
    cleanup() {
      for (const [ip, entry] of entries) {
        prune(entry);
        if (entry.active === 0 && entry.attempts.length === 0) {
          entries.delete(ip);
        }
      }
    },
    entries,
  };
}

export function createSlidingWindowLimiter({ limit, windowMs, now = () => Date.now() }) {
  const events = [];
  return {
    allow() {
      const cutoff = now() - windowMs;
      while (events[0] <= cutoff) {
        events.shift();
      }
      if (events.length >= limit) {
        return false;
      }
      events.push(now());
      return true;
    },
  };
}

function readFrames(buffer, { maxMessageBytes }) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const fin = (firstByte & 0x80) === 0x80;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (!fin || !masked || ![0x1, 0x8, 0x9, 0xA].includes(opcode)) {
      throw new Error('Unsupported WebSocket frame');
    }

    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) {
        break;
      }

      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) {
        break;
      }

      const bigLength = buffer.readBigUInt64BE(offset + 2);

      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('WebSocket frame too large');
      }

      payloadLength = Number(bigLength);
      headerLength = 10;
    }

    if (payloadLength > maxMessageBytes) {
      throw new Error('WebSocket frame too large');
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;

    if (offset + frameLength > buffer.length) {
      break;
    }

    const mask = masked ? buffer.subarray(offset + headerLength, offset + headerLength + 4) : null;
    const payloadStart = offset + headerLength + maskLength;
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLength));

    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }

    frames.push({ opcode, payload });
    offset += frameLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset),
  };
}

function writeFrame(payload, opcode) {
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}
