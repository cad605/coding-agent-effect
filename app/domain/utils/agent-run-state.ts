import { Match } from "effect";

import { AgentRunState, AgentRunSystemMessage, AgentRunUserMessage } from "../models/agent-run.ts";
import type { AgentRunInput } from "../models/agent-run.ts";

export const DEFAULT_SYSTEM_PROMPT = [
  "You are a helpful assistant specialized in coding.",
  "Use the available tools whenever they help you inspect the project or make changes.",
  "When you have fully completed the user request, you must call the \"completeTask\" tool with a concise final summary.",
  "Do not treat plain assistant text as task completion.",
].join(" ");

export const buildRunState = (
  input: AgentRunInput,
): AgentRunState =>
  new AgentRunState({
    messages: Match.value(input.session).pipe(
      Match.when(null, () => [
        new AgentRunSystemMessage({
          content: input.system ?? DEFAULT_SYSTEM_PROMPT,
          role: "system",
        }),
        new AgentRunUserMessage({
          content: input.prompt,
          role: "user",
        }),
      ]),
      Match.orElse(({ messages }) => [
        ...messages,
        new AgentRunUserMessage({
          content: input.prompt,
          role: "user",
        }),
      ]),
    ),
  });
