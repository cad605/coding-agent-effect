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
    ToolResult: ({ toolName, output, truncated }) =>
      new AgentToolResultEvent({
        toolName,
        output,
        truncated,
      }),
    ToolFailure: ({ toolName, message, truncated }) =>
      new AgentToolFailureEvent({
        toolName,
        message,
        truncated,
      }),
    Completion: ({ summary, status }) =>
      new AgentCompletionEvent({
        summary,
        status,
      }),
  });
