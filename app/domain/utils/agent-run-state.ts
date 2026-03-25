import { Match } from "effect";
import type { Prompt } from "effect/unstable/ai";

import type {
  AgentRunAssistantPart,
  AgentRunInput,
  AgentRunMessage,
  AgentRunToolResultPart,
} from "../models/agent-run.ts";

export const DEFAULT_SYSTEM_PROMPT = [
  "You are a helpful assistant specialized in coding.",
  "Use the available tools whenever they help you inspect the project or make changes.",
  "When you have fully completed the user request, you must call the \"completeTask\" tool with a concise final summary.",
  "Do not treat plain assistant text as task completion.",
].join(" ");

const toPromptAssistantPart = (
  part: AgentRunAssistantPart,
): Prompt.AssistantMessagePartEncoded => {
  switch (part.type) {
    case "text":
      return {
        type: "text",
        text: part.text,
      };
    case "reasoning":
      return {
        type: "reasoning",
        text: part.text,
      };
    case "tool-call":
      return {
        type: "tool-call",
        id: part.id,
        name: part.name,
        params: part.params,
        providerExecuted: part.providerExecuted,
      };
    case "tool-result":
      return toPromptToolResultPart(part);
  }
};

const toPromptToolResultPart = (
  part: AgentRunToolResultPart,
): Prompt.ToolResultPartEncoded => ({
  type: "tool-result",
  id: part.id,
  name: part.name,
  isFailure: part.isFailure,
  result: part.result,
});

const toPromptMessage = (
  message: AgentRunMessage,
): Prompt.MessageEncoded => {
  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: message.content,
      };
    case "user":
      return {
        role: "user",
        content: message.content,
      };
    case "assistant":
      return {
        role: "assistant",
        content: message.content.map(toPromptAssistantPart),
      };
    case "tool":
      return {
        role: "tool",
        content: message.content.map(toPromptToolResultPart),
      };
  }
};

export const buildSessionMessages = (
  input: AgentRunInput,
): ReadonlyArray<Prompt.MessageEncoded> =>
  Match.value(input.session).pipe(
    Match.when(null, () => [
      {
        role: "system" as const,
        content: input.system ?? DEFAULT_SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: input.prompt,
      },
    ]),
    Match.orElse(({ messages }) => [
      ...messages.map(toPromptMessage),
      {
        role: "user" as const,
        content: input.prompt,
      },
    ]),
  );
