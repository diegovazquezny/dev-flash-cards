import { BetSide, BetStrategy } from "./strategies";
import { GameResults, Winner, WinnerType } from "../types/types";
import BaccaratGameEngine from "../../../baccarat-engine/src/gameEngine/baccaratGameEngine";

export const odds = {
  [Winner.banker]: 458597,
  [Winner.player]: 446247,
  [Winner.tie]: 95156,
};

export const percentages = {
  [Winner.banker]: (odds[Winner.banker] / 10000).toFixed(2) + "%",
  [Winner.player]: (odds[Winner.player] / 10000).toFixed(2) + "%",
  [Winner.tie]: (odds[Winner.tie] / 10000).toFixed(2) + "%",
};

function randomNumberGenerator() {
  return Math.floor(Math.random() * 1000001);
}

export function dealHand(): any {
  const hand = randomNumberGenerator();
  const gameResult: Record<"outcome", WinnerType> = { outcome: Winner.tie };
  if (hand <= odds[Winner.banker]) gameResult.outcome = Winner.banker;
  else if (hand <= odds[Winner.banker] + odds[Winner.player])
    gameResult.outcome = Winner.player;
  else gameResult.outcome = Winner.tie;
  return gameResult;
}

export function gameWithStrategy(
  strategy: BetSide[],
  bankRoll = 100,
  betSize = 10,
  hands = 10000
): GameResults[] {
  let strategyIndex = 0;
  let handNumber = 0;
  const results: GameResults[] = [];
  for (let i = 0; i < hands; i++) {
    const currentSide = strategy[strategyIndex].side;
    const currentBet = strategy[strategyIndex].bet * betSize;
    let unitsWon = 0;
    const result = dealHand();
    handNumber++;
    const gameData = {
      currentSide,
      currentBet,
    };
    if (result.outcome === currentSide) {
      bankRoll += currentBet;
      unitsWon =
        result.outcome === Winner.banker ? 0.95 * currentBet : currentBet;
      strategyIndex = 0;
    } else if (result.outcome !== Winner.tie) {
      bankRoll -= currentBet;
      unitsWon = -currentBet;
      strategyIndex++;
      if (strategyIndex > strategy.length - 1) {
        strategyIndex = 0;
      }
    }
    results.push({
      ...gameData,
      winner: result.outcome!,
      bankRoll,
      unitsWon,
      strategyIndex,
      handNumber,
      id: crypto.randomUUID(),
      bust: false,
      targetReached: false,
    });
    if (bankRoll <= 0 || bankRoll < strategy[strategyIndex].bet * betSize) {
      results.at(-1).bust = true;
      break;
    }
  }
  return results;
}

export function gameWithStrategyUsingEngine(
  betStrategy: BetStrategy,
  bankRoll = 100,
  betSize = 10,
  hands = 10000,
  targetWinnings = 100
): GameResults[] {
  const { strategy, type } = betStrategy;
  const initialBankRoll = bankRoll;
  const gameEngine = new BaccaratGameEngine();
  gameEngine.shoe.createDecks();
  gameEngine.shoe.shuffle();
  gameEngine.burnCards();

  let strategyIndex = 0;
  let handNumber = 0;
  const results: GameResults[] = [];

  for (let i = 0; i < hands; i++) {
    if (gameEngine.isBurnNeeded) {
      gameEngine.shoe.shuffle();
      gameEngine.burnCards();
    }

    handNumber++;
    let unitsWon = 0;

    const currentSide = strategy[strategyIndex].side;
    const hand = gameEngine.dealGame();
    const result = gameEngine.resultsEngine.calculateGameResult(hand);
    const gameData: { currentSide: WinnerType; currentBet: number } = {
      currentSide,
      currentBet: 0,
    };

    switch (type) {
      case "Martingale":
      case "Fibonacci":
      case "FixedAmount":
      default:
        gameData.currentBet = strategy[strategyIndex].bet * betSize;
        break;
      case "FixedPercentage":
        gameData.currentBet = Math.floor(
          bankRoll * strategy[strategyIndex].bet
        );
        if (gameData.currentBet < betSize) {
          gameData.currentBet = betSize;
        }
        break;
    }
    if (result.outcome === currentSide) {
      bankRoll += gameData.currentBet;
      unitsWon =
        result.outcome === Winner.banker
          ? 0.95 * gameData.currentBet
          : gameData.currentBet;
      strategyIndex = 0;
    } else if (result.outcome !== Winner.tie) {
      bankRoll -= gameData.currentBet;
      unitsWon = -gameData.currentBet;
      strategyIndex++;
      if (strategyIndex > strategy.length - 1) {
        strategyIndex = 0;
      }
    }

    results.push({
      ...gameData,
      winner: result.outcome!,
      bankRoll,
      unitsWon,
      strategyIndex,
      handNumber,
      id: crypto.randomUUID(),
      bust: false,
      targetReached: false,
    });
    if (bankRoll <= 0 || bankRoll < strategy[strategyIndex].bet * betSize) {
      results.at(-1).bust = true;
      break;
    }
    if (initialBankRoll + targetWinnings <= bankRoll) {
      results.at(-1).targetReached = true;
      break;
    }
  }
  return results;
}
