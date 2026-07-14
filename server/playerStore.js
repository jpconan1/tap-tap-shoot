import { readFile, writeFile } from 'node:fs/promises';

import { DEFAULT_RATING, updateRatings } from './elo.js';

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

  async recordMatchResult({ winnerId, loserId, playedAt }) {
    const winner = await this.getPlayer(winnerId);
    const loser = await this.getPlayer(loserId);
    const ratings = updateRatings(winner.rating, loser.rating, true);
    const savedWinner = {
      ...winner,
      rating: ratings.player,
      wins: winner.wins + 1,
      lastPlayed: playedAt,
    };
    const savedLoser = {
      ...loser,
      rating: ratings.opponent,
      losses: loser.losses + 1,
      lastPlayed: playedAt,
    };

    this.players.set(savedWinner.id, savedWinner);
    this.players.set(savedLoser.id, savedLoser);
    return { winner: { ...savedWinner }, loser: { ...savedLoser } };
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

  async recordMatchResult(result) {
    await this.load();
    const saved = await super.recordMatchResult(result);
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
    this.secretKey = secretKey ?? serviceRoleKey;
    this.fetch = fetchImpl;

    if (!url || !this.secretKey) {
      throw new Error('SupabasePlayerStore requires a url and secret key');
    }

    this.url = url.replace(/\/$/, '');
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

    const [row] = await readSupabaseJson(response);

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

    const [row] = await readSupabaseJson(response);

    if (!row) {
      throw new Error('Could not save player: Supabase returned no row');
    }

    return fromPlayerRow(row);
  }

  async recordMatchResult({ matchId, winnerId, loserId, playedAt }) {
    const url = this.createRestUrl('/rpc/record_ranked_match', {});
    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.createHeaders(),
      body: JSON.stringify({
        p_match_id: matchId,
        p_winner_id: winnerId,
        p_loser_id: loserId,
        p_played_at: playedAt,
      }),
    });

    if (!response.ok) {
      await throwSupabaseResponseError('record ranked match', response);
    }

    const result = await readSupabaseJson(response);
    if (!result?.winner || !result?.loser) {
      throw new Error('Could not record ranked match: Supabase returned an invalid result');
    }

    return {
      winner: fromPlayerRow(result.winner),
      loser: fromPlayerRow(result.loser),
    };
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
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }
}

export class FallbackPlayerStore {
  constructor(primary, fallback, { onError = () => {} } = {}) {
    this.primary = primary;
    this.fallback = fallback;
    this.onError = onError;
    this.useFallback = false;
  }

  async getPlayer(playerId) {
    if (this.useFallback) {
      return this.fallback.getPlayer(playerId);
    }

    try {
      return await this.primary.getPlayer(playerId);
    } catch (error) {
      this.useFallback = true;
      this.onError(error);
      return this.fallback.getPlayer(playerId);
    }
  }

  async savePlayer(player) {
    if (this.useFallback) {
      return this.fallback.savePlayer(player);
    }

    try {
      return await this.primary.savePlayer(player);
    } catch (error) {
      this.useFallback = true;
      this.onError(error);
      return this.fallback.savePlayer(player);
    }
  }

  async recordMatchResult(result) {
    if (this.useFallback) {
      return this.fallback.recordMatchResult(result);
    }

    try {
      return await this.primary.recordMatchResult(result);
    } catch (error) {
      this.useFallback = true;
      this.onError(error);
      return this.fallback.recordMatchResult(result);
    }
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

async function readSupabaseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Could not parse Supabase response: ${error.message}`);
  }
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
