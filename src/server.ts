#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { YouMapClient } from "./client.js";
import { TOOLS } from "./tools/index.js";
import express from "express";
import cors from "cors";

class YouMapMCPServer {
  private server: Server;
  private youmapClient: YouMapClient;
  private app?: express.Application;

  constructor() {
    this.server = new Server(
      {
        name: "youmap-mcp",
        version: "1.0.0",
        description:
          "YouMap MCP Server - Create interactive maps, posts, actions and manage geographic content through the YouMap platform API",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.youmapClient = new YouMapClient({
      baseURL:
        process.env.YOUMAP_BASE_URL || "https://developer.youmap.com/api/v1/",
      clientId: process.env.YOUMAP_CLIENT_ID,
      clientSecret: process.env.YOUMAP_CLIENT_SECRET,
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await tool.handler(args, this.youmapClient);

        return {
          content: [
            {
              type: "text",
              text:
                typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Error in tool ${name}:`, error);
        throw error;
      }
    });
  }

  async startStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("YouMap MCP Server started in stdio mode");
  }

  async startHttp(port: number = 3000) {
    this.app = express();

    // Enable CORS for external access
    this.app.use(
      cors({
        origin: true, // Allow all origins for MCP
        credentials: true,
      })
    );

    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        server: "youmap-mcp",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    });

    // MCP endpoint info
    this.app.get("/", (req, res) => {
      res.json({
        name: "youmap-mcp",
        version: "1.0.0",
        description:
          "YouMap MCP Server - Create interactive maps, posts, actions and manage geographic content",
        endpoints: {
          tools: "/tools",
          callTool: "/call-tool",
        },
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      });
    });

    // Tools info endpoint
    this.app.get("/tools", (req, res) => {
      res.json({
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
    });

    // Call tool endpoint (REST API style)
    this.app.post("/call-tool", async (req, res) => {
      try {
        const { name, arguments: args } = req.body;

        if (!name) {
          return res.status(400).json({
            error: "Missing tool name",
            message: "Tool name is required",
          });
        }

        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          return res.status(404).json({
            error: "Unknown tool",
            message: `Tool '${name}' not found`,
          });
        }

        const result = await tool.handler(args || {}, this.youmapClient);

        res.json({
          success: true,
          result: typeof result === "string" ? result : result,
          tool: name,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Tool execution error:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          tool: req.body?.name,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Middleware to check Accept headers for JSON-RPC MCP endpoints
    const checkMCPHeaders = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const acceptHeader = req.get("Accept") || "";

      // Check if it's a JSON-RPC MCP request
      if (req.path.includes("/mcp") && req.method === "POST") {
        if (
          !acceptHeader.includes("application/json") ||
          !acceptHeader.includes("text/event-stream")
        ) {
          return res.status(406).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message:
                "Not Acceptable: Client must accept both application/json and text/event-stream",
            },
            id: null,
          });
        }
      }
      next();
    };

    this.app.use(checkMCPHeaders);

    // Helper function to create YouMap client with credentials and API keys
    const createYouMapClient = (
      clientId: string,
      clientSecret?: string,
      serpApiKey?: string,
      unsplashAccessKey?: string,
      bflApiKey?: string
    ): YouMapClient => {
      return new YouMapClient({
        baseURL: process.env.YOUMAP_BASE_URL || "https://developer.youmap.com",
        clientId,
        clientSecret,
        serpApiKey,
        unsplashAccessKey,
        bflApiKey,
      });
    };

    // JSON-RPC MCP endpoint - AgentKit compatible with API keys support
    // URL format: /:clientId/:clientSecret/v1/mcp?serpApiKey=...&unsplashAccessKey=...&bflApiKey=...
    this.app.post("/:clientId/:clientSecret/v1/mcp", async (req, res) => {
      const { clientId, clientSecret } = req.params;
      const { serpApiKey, unsplashAccessKey, bflApiKey } = req.query;
      const { jsonrpc, method, params, id } = req.body;

      console.log("=== MCP JSON-RPC REQUEST ===");
      console.log("Client ID:", clientId.substring(0, 8) + "...");
      console.log("Method:", method);
      console.log("Has SERP API Key:", !!serpApiKey);
      console.log("Has Unsplash Key:", !!unsplashAccessKey);
      console.log("Has BFL API Key:", !!bflApiKey);
      console.log("Params:", params);
      console.log("JSON-RPC Version:", jsonrpc);
      console.log("Request ID:", id);
      console.log("Headers Accept:", req.get("Accept"));
      console.log("============================");

      // Validate JSON-RPC
      if (jsonrpc !== "2.0") {
        return res.json({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Invalid Request: jsonrpc must be 2.0",
          },
          id: id,
        });
      }

      // Validate credentials
      if (!clientId || !clientSecret) {
        return res.json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Unauthorized: Missing clientId or clientSecret",
          },
          id: id,
        });
      }

      try {
        // Create YouMap client with provided credentials and API keys
        const youmapClient = createYouMapClient(
          clientId,
          clientSecret,
          serpApiKey as string,
          unsplashAccessKey as string,
          bflApiKey as string
        );

        switch (method) {
          case "tools/list":
          case "list":
          case "list_tools":
          case "initialize":
          case "list_actions":
            // Handle initialize method for MCP protocol
            if (method === "initialize") {
              return res.json({
                jsonrpc: "2.0",
                result: {
                  protocolVersion: "2024-11-05",
                  capabilities: {
                    tools: {},
                  },
                  serverInfo: {
                    name: "youmap-mcp",
                    version: "1.0.0",
                  },
                },
                id: id,
              });
            }

            const tools = TOOLS.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            }));

            return res.json({
              jsonrpc: "2.0",
              result: {
                tools: tools,
              },
              id: id,
            });

          case "tools/call":
          case "call_tool":
          case "call_action":
            const { name, arguments: args } = params || {};

            if (!name) {
              return res.json({
                jsonrpc: "2.0",
                error: {
                  code: -32602,
                  message: "Invalid params: tool name is required",
                },
                id: id,
              });
            }

            const tool = TOOLS.find((t) => t.name === name);

            if (!tool) {
              return res.json({
                jsonrpc: "2.0",
                error: {
                  code: -32601,
                  message: `Method not found: ${name}`,
                },
                id: id,
              });
            }

            // Execute tool with the authenticated YouMap client
            const result = await tool.handler(args || {}, youmapClient);

            return res.json({
              jsonrpc: "2.0",
              result: {
                content: [
                  {
                    type: "text",
                    text:
                      typeof result === "string"
                        ? result
                        : JSON.stringify(result, null, 2),
                  },
                ],
              },
              id: id,
            });

          default:
            return res.json({
              jsonrpc: "2.0",
              error: {
                code: -32601,
                message: `Method not found: ${method}`,
              },
              id: id,
            });
        }
      } catch (error) {
        console.error("MCP JSON-RPC Error:", error);

        // Handle authentication errors specifically
        if (
          error instanceof Error &&
          (error.message.includes("401") ||
            error.message.includes("Unauthorized") ||
            error.message.includes("Invalid credentials"))
        ) {
          return res.json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Unauthorized: Invalid YouMap credentials",
              data: error.message,
            },
            id: id,
          });
        }

        return res.json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
            data: error instanceof Error ? error.message : "Unknown error",
          },
          id: id,
        });
      }
    });

    this.app.listen(port, "0.0.0.0", () => {
      console.log(`YouMap MCP Server running on http://0.0.0.0:${port}`);
      console.log(`Health check: http://0.0.0.0:${port}/health`);
      console.log(`Tools list: http://0.0.0.0:${port}/tools`);
      console.log(`Call tool: POST http://0.0.0.0:${port}/call-tool`);
      console.log(
        `JSON-RPC MCP: POST http://0.0.0.0:${port}/{clientId}/{clientSecret}/v1/mcp`
      );
      console.log(
        `AgentKit URL format: https://mcp.youmap.com/{clientId}/{clientSecret}/v1/mcp`
      );
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  }
}

// Check if running in HTTP mode vs stdio mode
const mode = process.env.MCP_MODE || "stdio";
const port = parseInt(process.env.PORT || "3000");

const server = new YouMapMCPServer();

if (mode === "http") {
  server.startHttp(port).catch((error) => {
    console.error("Failed to start HTTP server:", error);
    process.exit(1);
  });
} else {
  server.startStdio().catch((error) => {
    console.error("Failed to start stdio server:", error);
    process.exit(1);
  });
}
