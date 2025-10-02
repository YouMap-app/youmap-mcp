#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { YouMapClient } from "./client.js";
import { TOOLS } from "./tools/index.js";
class YouMapMCPServer {
    server;
    youmapClient;
    constructor() {
        this.server = new Server({
            name: "youmap-mcp",
            version: "1.0.0",
            description: "YouMap MCP Server - Create interactive maps, posts, actions and manage geographic content through the YouMap platform API",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.youmapClient = new YouMapClient({
            baseURL: process.env.YOUMAP_BASE_URL || "https://developer.youmap.com/api/v1/",
            clientId: process.env.YOUMAP_CLIENT_ID,
            clientSecret: process.env.YOUMAP_CLIENT_SECRET,
        });
        this.setupHandlers();
    }
    setupHandlers() {
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
                            text: typeof result === "string"
                                ? result
                                : JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("YouMap MCP Server (youmap-mcp) started - Ready to manage maps and geographic content");
    }
}
const server = new YouMapMCPServer();
server.start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map