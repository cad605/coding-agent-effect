import { Match } from "effect";

import {
  AgentCompletionEvent,
  type AgentEvent,
  AgentTextEvent,
  AgentToolCallEvent,
  AgentToolFailureEvent,
  AgentToolResultEvent,
} from "../models/agent-events.ts";
import type { AgentExecutorEvent } from "../models/agent-executor.ts";

export const mapExecutorEvent = (
  event: AgentExecutorEvent,
): AgentEvent =>
  Match.valueTags(event, {
    AssistantText: ({ text }) => new AgentTextEvent({ text }),
    ToolCall: ({ toolName, input }) =>
      new AgentToolCallEvent({
        toolName,
        input,
      }),
    ToolResult: ({ toolName, output, durationMs, truncated }) =>
      new AgentToolResultEvent({
        toolName,
        output,
        durationMs,
        truncated,
      }),
    ToolFailure: ({ toolName, message, durationMs, truncated }) =>
      new AgentToolFailureEvent({
        toolName,
        message,
        durationMs,
        truncated,
      }),
    Completion: ({ summary, status }) =>
      new AgentCompletionEvent({
        summary,
        status,
      }),
  });
