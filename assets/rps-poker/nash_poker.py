#!/usr/bin/env python3
"""Approximate Nash solver for the RPS Poker rules in new-poker.txt.

The match is solved backwards one two-hand ante level at a time.  Each normal
hand is a finite, two-player, zero-sum imperfect-information game solved with
CFR.  RPS rotation symmetry supplies an equilibrium where locks are uniform;
conditional on the public community move, both private strengths are therefore
independent uniform High/Middle/Low cards.

Values are player 0's probability of eventually owning all 18 chips.  Strategy
JSON describes betting after the community move.  An information-set key is
"player|strength|history"; histories use x (check), bN (bet to N), f, c, and rN.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


TOTAL_CHIPS = 18
MAX_PAYABLE_ANTE = 9
STRENGTHS = ("low", "middle", "high")
EPS = 1e-15


def insufficient_ante_value(chips: int) -> float:
    """Player 0 match value when the scheduled ante cannot be paid.

    Unequal stacks end immediately in favor of the larger stack.  The only
    equal split of 18 chips is 9-9; its repeating all-in Poker showdown is fair.
    """
    opponent = TOTAL_CHIPS - chips
    if chips == opponent:
        return 0.5
    return float(chips > opponent)


@dataclass(frozen=True)
class BetState:
    contributions: tuple[int, int] = (0, 0)
    actor: int = 0
    checks: int = 0
    min_raise: int = 1
    history: tuple[str, ...] = ()


def legal_actions(state: BetState, cap: int) -> tuple[tuple[str, int | None], ...]:
    """Return (display label, new contribution), with None for non-wagers."""
    mine = state.contributions[state.actor]
    theirs = state.contributions[1 - state.actor]
    if mine == theirs:
        actions: list[tuple[str, int | None]] = [("x", None)]
        actions.extend((f"b{target}", target) for target in range(mine + 1, cap + 1))
        return tuple(actions)

    actions = [("f", None), ("c", None)]
    targets = set(range(theirs + state.min_raise, cap + 1))
    if cap > theirs:  # short all-in raise is always legal
        targets.add(cap)
    actions.extend((f"r{target}", target) for target in sorted(targets) if target > theirs)
    return tuple(actions)


def advance(state: BetState, action: tuple[str, int | None]) -> BetState | None:
    label, target = action
    if label in ("f", "c") or (label == "x" and state.checks == 1):
        return None
    if label == "x":
        return BetState(state.contributions, 1 - state.actor, 1, state.min_raise, state.history + (label,))
    contributions = list(state.contributions)
    previous_high = max(contributions)
    contributions[state.actor] = int(target)
    return BetState(
        tuple(contributions), 1 - state.actor, 0, int(target) - previous_high,
        state.history + (label,),
    )


class HandSolver:
    def __init__(self, chips: int, ante: int, first: int, continuation: dict[int, float]):
        self.chips = chips
        self.ante = ante
        self.first = first
        self.behind = (chips - ante, TOTAL_CHIPS - chips - ante)
        self.cap = min(self.behind)
        self.continuation = continuation
        self.regret: dict[str, list[float]] = {}
        self.strategy_sum: dict[str, list[float]] = {}
        self.action_names: dict[str, tuple[str, ...]] = {}
        self.regret_delta: dict[str, list[float]] = {}
        self.strategy_delta: dict[str, list[float]] = {}
        self.average_weight = 1.0

    @staticmethod
    def info_key(player: int, card: int, state: BetState) -> str:
        history = ".".join(state.history) or "start"
        return f"p{player}|{STRENGTHS[card]}|{history}"

    def strategy(self, key: str, count: int) -> list[float]:
        regrets = self.regret.setdefault(key, [0.0] * count)
        positive = [max(0.0, value) for value in regrets]
        total = sum(positive)
        return [value / total for value in positive] if total > EPS else [1.0 / count] * count

    def next_value(self, final_chips: int) -> float:
        if final_chips <= 0:
            return 0.0
        if final_chips >= TOTAL_CHIPS:
            return 1.0
        return self.continuation[final_chips]

    def terminal_value(self, cards: tuple[int, int], state: BetState, label: str) -> float:
        contributions = list(state.contributions)
        if label == "c":
            contributions[state.actor] = contributions[1 - state.actor]
        c0, c1 = contributions
        if label == "f":
            winner = 1 - state.actor
        elif cards[0] == cards[1]:
            return self.continuation[self.chips]
        else:
            winner = 0 if cards[0] > cards[1] else 1
        pot = 2 * self.ante + c0 + c1
        final = self.behind[0] - c0 + (pot if winner == 0 else 0)
        return self.next_value(final)

    def walk(self, cards: tuple[int, int], state: BetState, reach0: float, reach1: float, chance: float) -> float:
        actions = legal_actions(state, self.cap)
        player = state.actor
        key = self.info_key(player, cards[player], state)
        names = tuple(label for label, _ in actions)
        self.action_names[key] = names
        mix = self.strategy(key, len(actions))
        own_reach = reach0 if player == 0 else reach1
        sums = self.strategy_delta.setdefault(key, [0.0] * len(actions))
        for index, probability in enumerate(mix):
            sums[index] += self.average_weight * chance * own_reach * probability

        utilities = []
        node_value = 0.0
        for probability, action in zip(mix, actions):
            following = advance(state, action)
            if following is None:
                utility = self.terminal_value(cards, state, action[0])
            elif player == 0:
                utility = self.walk(cards, following, reach0 * probability, reach1, chance)
            else:
                utility = self.walk(cards, following, reach0, reach1 * probability, chance)
            utilities.append(utility)
            node_value += probability * utility

        opponent_reach = reach1 if player == 0 else reach0
        sign = 1.0 if player == 0 else -1.0
        regrets = self.regret_delta.setdefault(key, [0.0] * len(actions))
        for index, utility in enumerate(utilities):
            regrets[index] += chance * opponent_reach * sign * (utility - node_value)
        return node_value

    def solve(self, iterations: int) -> tuple[float, dict[str, dict[str, float]]]:
        root = BetState(actor=self.first)
        for iteration in range(1, iterations + 1):
            self.regret_delta = {}
            self.strategy_delta = {}
            self.average_weight = iteration  # linear CFR averaging
            for card0 in range(3):
                for card1 in range(3):
                    self.walk((card0, card1), root, 1.0, 1.0, 1.0 / 9.0)
            for key, delta in self.regret_delta.items():
                old = self.regret[key]
                self.regret[key] = [max(0.0, value + change) for value, change in zip(old, delta)]
            for key, delta in self.strategy_delta.items():
                old = self.strategy_sum.setdefault(key, [0.0] * len(delta))
                self.strategy_sum[key] = [value + change for value, change in zip(old, delta)]

        policy = {}
        for key, totals in self.strategy_sum.items():
            total = sum(totals)
            if total <= EPS:
                mix = self.strategy(key, len(totals))
            else:
                mix = [value / total for value in totals]
            policy[key] = {
                action: probability for action, probability in zip(self.action_names[key], mix)
                if probability > 1e-9
            }

        value = 0.0
        for card0 in range(3):
            for card1 in range(3):
                value += self.evaluate((card0, card1), root, policy) / 9.0
        return value, policy

    def evaluate(self, cards: tuple[int, int], state: BetState, policy: dict[str, dict[str, float]]) -> float:
        actions = legal_actions(state, self.cap)
        key = self.info_key(state.actor, cards[state.actor], state)
        node = 0.0
        for action in actions:
            probability = policy[key].get(action[0], 0.0)
            following = advance(state, action)
            utility = self.terminal_value(cards, state, action[0]) if following is None else self.evaluate(cards, following, policy)
            node += probability * utility
        return node


def state_key(ante: int, phase: int, chips: int, first: int) -> str:
    return f"a{ante}|h{phase}|c{chips}|first{first}"


def solve_match(iterations: int = 1_000):
    """Return values and policies keyed by ante, hand phase, chips, and actor."""
    terminal_ante = MAX_PAYABLE_ANTE + 1
    values_by_ante: dict[int, dict[tuple[int, int, int], float]] = {terminal_ante: {}}
    policies: dict[str, dict[str, dict[str, float]]] = {}
    for chips in range(1, 18):
        for phase in (1, 2):
            for first in (0, 1):
                value = insufficient_ante_value(chips)
                values_by_ante[terminal_ante][chips, phase, first] = value
                policy = (
                    {"all_in_poker": {"rock": 1 / 3, "paper": 1 / 3, "scissors": 1 / 3}}
                    if chips == 9 else {}
                )
                policies[state_key(terminal_ante, phase, chips, first)] = policy

    for ante in range(MAX_PAYABLE_ANTE, 0, -1):
        values: dict[tuple[int, int, int], float] = {}
        # Phase 2 advances to the next ante. Phase 1 then uses the completed
        # phase-2 table at this same ante.
        for phase in (2, 1):
            representatives = (
                [(chips, first) for chips in range(1, 9) for first in (0, 1)]
                + [(9, 0)]
            )
            for chips, first in representatives:
                opponent = TOTAL_CHIPS - chips
                if min(chips, opponent) < ante:
                    value = insufficient_ante_value(chips)
                    policy = {}
                else:
                    if phase == 1:
                        continuation = {
                            x: values[x, 2, 1 - first] for x in range(1, 18)
                        }
                    else:
                        next_values = values_by_ante[ante + 1]
                        continuation = {
                            x: next_values[x, 1, 1 - first] for x in range(1, 18)
                        }
                    solver = HandSolver(chips, ante, first, continuation)
                    value, policy = solver.solve(iterations)
                values[chips, phase, first] = value
                policies[state_key(ante, phase, chips, first)] = policy

                mirror_chips, mirror_first = 18 - chips, 1 - first
                values[mirror_chips, phase, mirror_first] = 1.0 - value
                mirror_policy = {}
                for key, mix in policy.items():
                    player, strength, history = key.split("|", 2)
                    mirror_policy[f"p{1 - int(player[1:])}|{strength}|{history}"] = mix
                policies[state_key(ante, phase, mirror_chips, mirror_first)] = mirror_policy
        values_by_ante[ante] = values
    return values_by_ante, policies


def write_report(path: Path, values, policies, iterations: int) -> None:
    first0 = values[1][9, 1, 0]
    first1 = values[1][9, 1, 1]
    old_first0 = 0.49875130739063017
    old_first1 = 0.5012486926093698
    old_bet_frequencies = {"low": 0.0971, "middle": 0.2241, "high": 0.4891}
    lines = [
        "Revised RPS Poker equilibrium report", "",
        f"CFR iterations per normal state: {iterations:,}",
        "Locks: Rock 33.33%, Paper 33.33%, Scissors 33.33% (rotation-symmetric equilibrium).",
        f"Start value when player 0 acts first: {first0 * 100:.6f}%",
        f"Start value when player 1 acts first: {first1 * 100:.6f}%",
        f"Start value with random first actor: {(first0 + first1) * 50:.6f}%", "",
        "Starting betting mix when player 0 acts first", "strength    actions",
    ]
    root = policies["a1|h1|c9|first0"]
    for strength in STRENGTHS:
        mix = root[f"p0|{strength}|start"]
        actions = ", ".join(f"{action} {probability * 100:.2f}%" for action, probability in mix.items() if probability > 1e-4)
        lines.append(f"{strength:<11} {actions}")
    lines += [
        "",
        "Comparison with previous rules",
        f"- Previous first-actor edge for player 0: {(old_first0 - 0.5) * 100:+.6f} percentage points.",
        f"- Revised first-actor edge for player 0: {(first0 - 0.5) * 100:+.6f} percentage points.",
    ]
    for strength in STRENGTHS:
        mix = root[f"p0|{strength}|start"]
        aggression = 1.0 - mix.get("x", 0.0)
        old_aggression = old_bet_frequencies[strength]
        lines.append(
            f"- Opening bet frequency with {strength}: "
            f"{old_aggression * 100:.2f}% previous, {aggression * 100:.2f}% revised "
            f"({(aggression - old_aggression) * 100:+.2f} points)."
        )
    lines += [
        "- Antes now last two hands, giving each player first position once before the risk level rises.",
        "- The slower schedule preserves more normal Poker decisions before insufficient-ante resolution.",
        "",
        "Insufficient ante",
        "- Unequal stacks: the shorter stack loses immediately before a hand is dealt.",
        "- Equal 9-9 stacks: both players play repeating all-in community-ranked Poker until decisive.",
        "- There is no standard-RPS or forced-RPS phase.",
        f"- Previous random-first start value: {(old_first0 + old_first1) * 50:.6f}%.",
        f"- Revised random-first start value: {(first0 + first1) * 50:.6f}%.",
    ]
    lines += ["", "Files", "- poker_policy.json contains every match-state value and betting information set.",
              "- Values are match-win probabilities; CFR policies are approximate Nash strategies."]
    path.write_text("\n".join(lines) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=1_000, help="CFR iterations per normal match state")
    parser.add_argument("--json", type=Path, default=Path("poker_policy.json"))
    parser.add_argument("--report", type=Path, default=Path("poker_report.txt"))
    args = parser.parse_args()
    values, policies = solve_match(args.iterations)
    payload = {
        "game": "Revised RPS Poker",
        "method": "backward induction with CFR",
        "iterations_per_normal_state": args.iterations,
        "strength_deal": {strength: 1 / 3 for strength in STRENGTHS},
        "values": {
            state_key(ante, phase, chips, first): value
            for ante, table in values.items()
            for (chips, phase, first), value in table.items()
        },
        "policies": policies,
    }
    args.json.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    write_report(args.report, values, policies, args.iterations)
    print(args.report.read_text(), end="")


if __name__ == "__main__":
    main()
