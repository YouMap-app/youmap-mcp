import axios from "axios";

export interface ToolCallLogData {
  correlationId: string;
  toolName: string;
  parameters: any;
  response: any;
  error: any;
  duration: number;
  success: boolean;
  sequenceNumber: number;
  clientId?: string;
}

/**
 * Log a tool call to the YouMap API internal logging endpoint
 */
export async function logToolCallToAPI(data: ToolCallLogData): Promise<void> {
  // Only log if the API URL and key are configured
  const apiUrl = process.env.YOUMAP_API_URL;
  const apiKey = process.env.YOUMAP_INTERNAL_API_KEY;

  if (!apiUrl || !apiKey) {
    console.warn(
      "MCP Logging: YOUMAP_API_URL or YOUMAP_INTERNAL_API_KEY not configured - skipping log"
    );
    return;
  }

  try {
    await axios.post(
      `${apiUrl}/internal/ai-logs/mcp-tool-call`,
      {
        ...data,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "X-Internal-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    console.log(
      `✓ Logged tool call: ${data.toolName} (correlation: ${data.correlationId}, seq: ${data.sequenceNumber})`
    );
  } catch (error) {
    // Don't throw - logging failures shouldn't break tool execution
    console.error(
      "Failed to log tool call to API:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Extract correlation ID from request headers
 */
export function extractCorrelationId(headers: any): string | undefined {
  if (!headers) return undefined;

  // Check various header formats (case-insensitive)
  const correlationId =
    headers["x-correlation-id"] ||
    headers["X-Correlation-ID"] ||
    headers["X-Correlation-Id"] ||
    headers["x-correlation-Id"];

  return correlationId as string | undefined;
}
