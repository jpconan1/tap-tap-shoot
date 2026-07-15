export class NullAnalyticsStore {
  async recordMatchStarted() {}
  async recordVariantPick() {}
  async recordTurn() {}
  async recordVariantGame() {}
  async recordMatchEnded() {}
}

export class MemoryAnalyticsStore extends NullAnalyticsStore {
  constructor() {
    super();
    this.matches = [];
    this.variantPicks = [];
    this.turns = [];
    this.variantGames = [];
    this.matchEnds = [];
  }

  async recordMatchStarted(value) { this.matches.push(structuredClone(value)); }
  async recordVariantPick(value) { this.variantPicks.push(structuredClone(value)); }
  async recordTurn(value) { this.turns.push(structuredClone(value)); }
  async recordVariantGame(value) { this.variantGames.push(structuredClone(value)); }
  async recordMatchEnded(value) { this.matchEnds.push(structuredClone(value)); }
}

export class SupabaseAnalyticsStore extends NullAnalyticsStore {
  constructor({ url, secretKey, serviceRoleKey, fetchImpl = fetch }) {
    this.secretKey = secretKey ?? serviceRoleKey;
    this.fetch = fetchImpl;
    if (!url || !this.secretKey) throw new Error('SupabaseAnalyticsStore requires a url and secret key');
    this.url = url.replace(/\/$/, '');
  }

  recordMatchStarted(match) {
    return this.insert('/analytics_matches', {
      id: match.matchId,
      started_at: match.startedAt,
      p1_id: match.p1Id,
      p2_id: match.p2Id,
    }, 'resolution=ignore-duplicates');
  }

  recordVariantPick(pick) {
    return this.insert('/analytics_variant_picks', {
      match_id: pick.matchId,
      selection_round: pick.selectionRound,
      player_slot: pick.playerSlot,
      variant_id: pick.variantId,
      pick_order: pick.pickOrder,
      picked_at: pick.pickedAt,
    }, 'resolution=ignore-duplicates');
  }

  recordTurn(turn) {
    return this.insert('/analytics_turns', {
      match_id: turn.matchId,
      variant_game_number: turn.variantGameNumber,
      round_number: turn.roundNumber,
      turn_number: turn.turnNumber,
      variant_id: turn.variantId,
      p1_move: turn.p1Move,
      p2_move: turn.p2Move,
      round_winner_slot: turn.roundWinnerSlot,
      recorded_at: turn.recordedAt,
    }, 'resolution=ignore-duplicates');
  }

  recordVariantGame(game) {
    return this.insert('/analytics_variant_games', {
      match_id: game.matchId,
      game_number: game.gameNumber,
      selection_round: game.selectionRound,
      variant_id: game.variantId,
      winner_slot: game.winnerSlot,
      p1_round_wins: game.roundWins.p1,
      p2_round_wins: game.roundWins.p2,
      turn_count: game.turnCount,
      ended_at: game.endedAt,
    }, 'resolution=ignore-duplicates');
  }

  async recordMatchEnded(match) {
    const url = this.createUrl('/analytics_matches', { id: `eq.${match.matchId}` });
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        ended_at: match.endedAt,
        status: match.status,
        winner_slot: match.winnerSlot,
        p1_game_wins: match.gameWins.p1,
        p2_game_wins: match.gameWins.p2,
        p1_timeout_strikes: match.timeoutStrikes.p1,
        p2_timeout_strikes: match.timeoutStrikes.p2,
        disconnected_slot: match.disconnectedSlot,
      }),
    });
    if (!response.ok) await throwResponseError('end analytics match', response);
  }

  async insert(pathname, body, prefer) {
    const response = await this.fetch(this.createUrl(pathname), {
      method: 'POST',
      headers: { ...this.headers(), Prefer: `${prefer},return=minimal` },
      body: JSON.stringify(body),
    });
    if (!response.ok) await throwResponseError('write analytics', response);
  }

  createUrl(pathname, params = {}) {
    const url = new URL(`${this.url}/rest/v1${pathname}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url;
  }

  headers() {
    return {
      apikey: this.secretKey,
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }
}

async function throwResponseError(action, response) {
  let detail = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    detail = body?.message || body?.error || detail;
  } catch {}
  throw new Error(`Could not ${action}: ${detail}`);
}
