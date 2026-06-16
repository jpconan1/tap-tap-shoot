import { readFile, writeFile } from 'node:fs/promises';

import { DEFAULT_RATING } from './elo.js';

export class MemoryPlayerStore {
  constructor(players = new Map()) {
    this.players = players;
  }

  async getPlayer(playerId) {
    const saved = this.players.get(playerId);

    if (saved) {
      return { ...saved };
    }

    const created = createDefaultPlayer(playerId);
    this.players.set(playerId, created);
    return { ...created };
  }

  async savePlayer(player) {
    this.players.set(player.id, { ...player });
    return { ...player };
  }
}

export class JsonPlayerStore extends MemoryPlayerStore {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.loaded = false;
  }

  async getPlayer(playerId) {
    await this.load();
    return super.getPlayer(playerId);
  }

  async savePlayer(player) {
    await this.load();
    const saved = await super.savePlayer(player);
    await this.flush();
    return saved;
  }

  async load() {
    if (this.loaded) {
      return;
    }

    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.players = new Map(Object.entries(parsed.players ?? {}));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    this.loaded = true;
  }

  async flush() {
    const players = Object.fromEntries(this.players.entries());
    await writeFile(this.filePath, `${JSON.stringify({ players }, null, 2)}\n`);
  }
}

export class SupabasePlayerStore {
  constructor({ url, secretKey, serviceRoleKey, fetchImpl = fetch }) {
    this.url = url.replace(/\/$/, '');
    this.secretKey = secretKey ?? serviceRoleKey;
    this.fetch = fetchImpl;
  }

  async getPlayer(playerId) {
    const url = this.createRestUrl('/players', {
      select: 'id,rating,wins,losses,last_played',
      id: `eq.${playerId}`,
      limit: '1',
    });
    const response = await this.fetch(url, {
      headers: this.createHeaders(),
    });

    if (!response.ok) {
      await throwSupabaseResponseError('load player', response);
    }

    const [row] = await response.json();

    return row ? fromPlayerRow(row) : this.savePlayer(createDefaultPlayer(playerId));
  }

  async savePlayer(player) {
    const url = this.createRestUrl('/players', {
      on_conflict: 'id',
      select: 'id,rating,wins,losses,last_played',
    });
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        ...this.createHeaders(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(toPlayerRow(player)),
    });

    if (!response.ok) {
      await throwSupabaseResponseError('save player', response);
    }

    const [row] = await response.json();
    return fromPlayerRow(row);
  }

  createRestUrl(pathname, params) {
    const url = new URL(`${this.url}/rest/v1${pathname}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url;
  }

  createHeaders() {
    return {
      apikey: this.secretKey,
      'Content-Type': 'application/json',
    };
  }
}

export function createDefaultPlayer(playerId) {
  return {
    id: playerId,
    rating: DEFAULT_RATING,
    wins: 0,
    losses: 0,
    lastPlayed: null,
  };
}

function fromPlayerRow(row) {
  return {
    id: row.id,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    lastPlayed: row.last_played,
  };
}

function toPlayerRow(player) {
  return {
    id: player.id,
    rating: player.rating,
    wins: player.wins,
    losses: player.losses,
    last_played: player.lastPlayed,
  };
}

async function throwSupabaseResponseError(action, response) {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body);
    const message = parsed.message ?? parsed.error ?? body;
    throw new Error(`Could not ${action}: ${message}`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Could not ${action}: ${response.status} ${body}`);
    }

    throw error;
  }
}
