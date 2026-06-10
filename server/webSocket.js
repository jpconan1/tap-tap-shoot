import { createHash } from 'node:crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function attachWebSocketServer(server, { path = '/ws', onConnection }) {
  server.on('upgrade', (request, socket) => {
    if (new URL(request.url, 'http://localhost').pathname !== path) {
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];

    if (!key) {
      socket.destroy();
      return;
    }

    const accept = createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'));

    const connection = createWebSocketConnection(socket);
    onConnection(connection, request);
  });
}

function createWebSocketConnection(socket) {
  let buffer = Buffer.alloc(0);
  const messageListeners = new Set();
  const closeListeners = new Set();

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = readFrames(buffer);
    buffer = parsed.remaining;

    for (const frame of parsed.frames) {
      if (frame.opcode === 0x8) {
        socket.end();
        return;
      }

      if (frame.opcode === 0x9) {
        socket.write(writeFrame(frame.payload, 0xA));
        continue;
      }

      if (frame.opcode === 0x1) {
        const message = frame.payload.toString('utf8');
        for (const listener of messageListeners) {
          listener(message);
        }
      }
    }
  });

  socket.on('close', () => {
    for (const listener of closeListeners) {
      listener();
    }
  });

  socket.on('error', () => {
    socket.destroy();
  });

  return {
    send(message) {
      if (!socket.destroyed) {
        socket.write(writeFrame(Buffer.from(message, 'utf8'), 0x1));
      }
    },
    close() {
      if (!socket.destroyed) {
        socket.end(writeFrame(Buffer.alloc(0), 0x8));
      }
    },
    onMessage(listener) {
      messageListeners.add(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
    },
  };
}

function readFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

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
