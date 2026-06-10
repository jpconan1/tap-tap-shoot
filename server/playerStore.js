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

export function createDefaultPlayer(playerId) {
  return {
    id: playerId,
    rating: DEFAULT_RATING,
    wins: 0,
    losses: 0,
    lastPlayed: null,
  };
}
