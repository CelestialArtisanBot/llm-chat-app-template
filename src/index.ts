/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI and Gemini API.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE) and Gemini API for content generation.
 *
 * @license MIT
 */

// --- Combined types.ts content ---
export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  GEMINI_API_KEY: string;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// --- Combined index.ts content ---
import { Ai } from "@cloudflare/ai";

// Default system prompt
const SYSTEM_PROMPT = "You are a helpful, friendly assistant. Provide concise and accurate responses.";

// Workers AI model
const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Gemini API endpoint
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }
      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const ai = new Ai(env.AI);
    // Parse JSON request body
    const { messages = [], model = "workers-ai" } = (await request.json()) as { messages: ChatMessage[]; model: string; };

    // Add system prompt if not present
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    let responseStream;
    if (model === "gemini") {
      responseStream = await generateStreamingResponseUsingGemini(messages, env);
    } else {
      responseStream = await generateStreamingResponseUsingWorkersAi(messages, ai);
    }

    // Return streaming response
    return new Response(responseStream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

/**
 * Generates streaming response using Workers AI
 */
async function generateStreamingResponseUsingWorkersAi(
  messages: ChatMessage[],
  ai: Ai,
): Promise<ReadableStream> {
  const stream = await ai.run(WORKERS_AI_MODEL, { messages, stream: true });
  return stream;
}

/**
 * Generates streaming response using Gemini API
 */
async function generateStreamingResponseUsingGemini(
  messages: ChatMessage[],
  env: Env,
): Promise<ReadableStream> {
  const prompt = messages.map((msg) => msg.content).join("\n");
  const geminiRequest = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  const headers = {
    "Content-Type": "application/json",
    "X-goog-api-key": env.GEMINI_API_KEY,
  };

  const response = await fetch(GEMINI_API_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(geminiRequest),
  });

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get reader from Gemini API response");
  }

  return new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = new TextDecoder().decode(value);
        controller.enqueue(`data: ${chunk}\n\n`);
      }
      controller.close();
    },
  });
}
