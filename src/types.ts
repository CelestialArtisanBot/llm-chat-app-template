/**
 * Type definitions for the LLM chat application.
 */

import { Ai } from "@cloudflare/ai";

export interface Env {
  /**
   * Binding for the Workers AI API.
   */
  AI: Ai;

  /**
   * Binding for static assets.
   */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  
  /**
   * Gemini API key.
   */
  GEMINI_API_KEY: string;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
