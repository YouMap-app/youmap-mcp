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
    this.app.use(cors({
      origin: true, // Allow all origins for MCP
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        server: 'youmap-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // MCP endpoint info
    this.app.get('/', (req, res) => {
      res.json({
        name: "youmap-mcp",
        version: "1.0.0",
        description: "YouMap MCP Server - Create interactive maps, posts, actions and manage geographic content",
        endpoints: {
          tools: "/tools",
          callTool: "/call-tool"
        },
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description
        }))
      });
    });

    // Tools info endpoint
    this.app.get('/tools', (req, res) => {
      res.json({
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
    });

    // Call tool endpoint (REST API style)
    this.app.post('/call-tool', async (req, res) => {
      try {
        const { name, arguments: args } = req.body;

        if (!name) {
          return res.status(400).json({
            error: 'Missing tool name',
            message: 'Tool name is required'
          });
        }

        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          return res.status(404).json({
            error: 'Unknown tool',
            message: `Tool '${name}' not found`
          });
        }

        const result = await tool.handler(args || {}, this.youmapClient);

        res.json({
          success: true,
          result: typeof result === "string" ? result : result,
          tool: name,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Tool execution error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          tool: req.body?.name,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.listen(port, '0.0.0.0', () => {
      console.log(`YouMap MCP Server running on http://0.0.0.0:${port}`);
      console.log(`Health check: http://0.0.0.0:${port}/health`);
      console.log(`Tools list: http://0.0.0.0:${port}/tools`);
      console.log(`Call tool: POST http://0.0.0.0:${port}/call-tool`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }
}

// Check if running in HTTP mode vs stdio mode
const mode = process.env.MCP_MODE || 'stdio';
const port = parseInt(process.env.PORT || '3000');

const server = new YouMapMCPServer();

if (mode === 'http') {
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