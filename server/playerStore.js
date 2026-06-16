import { readFile, writeFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

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
  constructor({ url, secretKey, serviceRoleKey, client = null }) {
    this.client = client ?? createClient(url, secretKey ?? serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async getPlayer(playerId) {
    const { data, error } = await this.client
      .from('players')
      .select('id, rating, wins, losses, last_played')
      .eq('id', playerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return fromPlayerRow(data);
    }

    const created = createDefaultPlayer(playerId);
    return this.savePlayer(created);
  }

  async savePlayer(player) {
    const { data, error } = await this.client
      .from('players')
      .upsert(toPlayerRow(player), { onConflict: 'id' })
      .select('id, rating, wins, losses, last_played')
      .single();

    if (error) {
      throw error;
    }

    return fromPlayerRow(data);
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
