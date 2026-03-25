import { AgentError, MissingCompletionSignal, TurnBudgetExceeded } from "../errors/agent.ts";
import type { AgentExecutorTurnResult } from "../models/agent-executor.ts";

export const MAX_TURNS = 24;

export const hasReachedTurnBudget = (turns: number): boolean => turns >= MAX_TURNS;

export const turnBudgetExceededError = (): AgentError =>
  new AgentError({
    reason: new TurnBudgetExceeded({ maxTurns: MAX_TURNS }),
  });

export const missingCompletionSignalError = (): AgentError =>
  new AgentError({
    reason: new MissingCompletionSignal({}),
  });

export const turnHasCompletion = (
  turn: AgentExecutorTurnResult,
): boolean => turn.completed;

export const turnHasToolActivity = (
  turn: AgentExecutorTurnResult,
): boolean => turn.hadToolCall;
