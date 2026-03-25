import { Match } from "effect";
import { AgentError, MissingCompletionSignal, TurnBudgetExceeded } from "../errors/agent.ts";
import type { AgentExecutorEvent, AgentExecutorTurnResult } from "../models/agent-executor.ts";

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

export const isCompletionEvent = (
  event: AgentExecutorEvent,
): boolean =>
  Match.value(event).pipe(
    Match.when({ _tag: "Completion" }, () => true),
    Match.orElse(() => false),
  );

export const isToolActivityEvent = (
  event: AgentExecutorEvent,
): boolean =>
  Match.value(event).pipe(
    Match.when({ _tag: "ToolCall" }, () => true),
    Match.when({ _tag: "ToolResult" }, () => true),
    Match.when({ _tag: "ToolFailure" }, () => true),
    Match.orElse(() => false),
  );

export const turnHasCompletion = (
  turn: AgentExecutorTurnResult,
): boolean => turn.events.some(isCompletionEvent);

export const turnHasToolActivity = (
  turn: AgentExecutorTurnResult,
): boolean => turn.events.some(isToolActivityEvent);
