import { Match } from "effect";

import type { AgentExecutorError } from "../errors/agent-executor.ts";
import {
  AgentError,
  ExecuteTurnFailed,
  ModelExecutionFailed,
  ToolExecutionFailed,
  UnsupportedRunMessage,
  UnsupportedRunPart,
} from "../errors/agent.ts";

export const mapAgentExecutorError = (
  error: AgentExecutorError,
): AgentError =>
  Match.valueTags(error.reason, {
    UnsupportedRuntimeMessage: ({ role }) =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new UnsupportedRunMessage({ role }),
        }),
      }),
    UnsupportedRuntimePart: ({ partType }) =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new UnsupportedRunPart({ partType }),
        }),
      }),
    ToolRuntimeFailed: ({ toolName, message }) =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new ToolExecutionFailed({ toolName, message }),
        }),
      }),
    ModelTurnFailed: () =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new ModelExecutionFailed({}),
        }),
      }),
  });
