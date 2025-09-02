import { YouMapClient } from "../client.js";
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any, client: YouMapClient) => Promise<any>;
}
export declare const TOOLS: MCPTool[];
//# sourceMappingURL=index.d.ts.map