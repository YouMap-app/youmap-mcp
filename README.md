# YouMap MCP Server

A Model Context Protocol (MCP) server for the YouMap API, enabling AI assistants to create and manage maps through natural language interactions.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @youmap/youmap-mcp
```

### Local Installation

```bash
npm install @youmap/youmap-mcp
```

## Usage

### With Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/.config/claude-desktop/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "youmap": {
      "command": "youmap-mcp",
      "env": {
        "YOUMAP_CLIENT_ID": "your_client_id_here",
        "YOUMAP_CLIENT_SECRET": "your_client_secret_here",
        "YOUMAP_BASE_URL": "https://developer.youmap.com",
        "SERP_API_KEY": "",
        "BFL_API_KEY": "",
        "UNSPLASH_ACCESS_KEY": ""
      }
    }
  }
}
```

### Environment Variables

- `YOUMAP_CLIENT_ID`: Your YouMap OAuth client ID (required)
- `YOUMAP_CLIENT_SECRET`: Your YouMap OAuth client secret (required)
- `YOUMAP_BASE_URL`: Base URL for the YouMap API (defaults to `https://youmap.com/api`)
- `SERP_API_KEY`: Key to SERP API to get images for posts
- `BFL_API_KEY`: Key to BFL to generate images using FLUX-PRO-1.1 model for maps
- `UNSPLASH_ACCESS_KEY`: Key to Unsplash that works as a fallback for SERP

## Authentication

This MCP server uses OAuth 2.0 client credentials flow for authentication. The server automatically:

1. Authenticates using your client ID and secret to obtain access tokens
2. Manages token refresh automatically when tokens expire
3. Retries failed requests with fresh tokens when needed

You need to obtain your client credentials from YouMap's developer portal or API settings.

## Available Tools

### `create_map`

Create a new map for organizing posts, places, and content geographically.

**Parameters:**

- `name` (required): Name of the map (3-50 characters)
- `description` (optional): Description of the map (5-500 characters)
- `accessLevel` (optional): Access level - `"public"`, `"inviteOnly"`, or `"private"` (default: `"public"`)
- `coverImageFromUrl` (optional): Cover image URL
- `invitedUserIds` (optional): Array of user IDs to invite (for `inviteOnly` maps)
- `categoryIds` (optional): Array of category IDs (1-3 categories, default: `[13]`)
- `readonly` (optional): Boolean to prevent others from posting (default: `false`)
- `boundingBox` (optional): Object with `north`, `south`, `east`, `west` coordinates

**Example Usage with Claude:**

```
"Create a public map called 'Coffee Shops in NYC' with description 'Best coffee spots in New York City' and set it to readonly"
```

### `create_post`

Create a new post on a map at a specific geographic location.

**Parameters:**

- `mapId` (required): ID of the map where the post will be created
- `latitude` (required): Latitude coordinate (-90 to 90)
- `longitude` (required): Longitude coordinate (-180 to 180)
- `actionId` (required): ID of the action/template to use for this post
- `name` (optional): Name/title of the post (max 100 characters)
- `description` (optional): Description or content of the post (max 500 characters)
- `address` (optional): Street address for the location
- `placeId` (optional): Place ID from mapping services
- `imageIds` (optional): Array of image IDs to attach to the post
- `saveAsTemplate` (optional): Save as template for future use (default: false)
- `contentOrigin` (optional): Origin of content - "App" or "PublicAPI" (default: "PublicAPI")
- `fields` (optional): Custom field values based on the action template

**Example Usage with Claude:**

```
"Create a post on map 123 at coordinates 40.7128, -74.0060 with action 456 titled 'Great Coffee Shop' and description 'Amazing espresso and friendly staff'"
```

### `create_action`

Create a new action (post template) that defines the structure for posts. Actions serve as blueprints for what fields and content types posts can contain.

**Parameters:**

- `name` (required): Name of the action/post template (3-50 characters)
- `mapId` (required): ID of the map this action belongs to
- `emoji` (optional): Emoji representing the action (default: ':speech_balloon:')
- `borderColor` (optional): Hex color for action border (e.g., '#FF5733')
- `duration` (optional): How long posts remain active - "forever", "1_hour", "6_hours", "12_hours", "1_day", "3_days", "1_week", "1_month" (default: "forever")
- `order` (optional): Display order among other actions
- `fields` (optional): Define field structure with textFields, mediaFields, websiteFields, ratingFields, dateField

**Example Usage with Claude:**

```
"Create an action on map 123 called 'Restaurant Review' with a food emoji and rating field"
"Make a post template for map 456 named 'Event Listing' with text fields for description and date field"
```

### `list_actions`

Retrieve actions (post templates) from a specific map that define available post structures.

**Parameters:**

- `mapId` (required): ID of the map to retrieve actions from
- `limit` (optional): Maximum number of actions to return (1-100, default: 20)
- `offset` (optional): Number of actions to skip for pagination (default: 0)
- `orderBy` (optional): Order by "id", "name", "emoji", "created_at", "updated_at", "order" (default: "order")
- `sort` (optional): Sort direction "asc" or "desc" (default: "asc")
- `enabledOnly` (optional): Only return enabled actions (default: true)
- `phrase` (optional): Search phrase to filter by name

**Example Usage with Claude:**

```
"Show me all actions available on map 123"
"List the post templates for map 456 ordered by name"
"Find actions on map 789 containing the word 'review'"
```

### `list_posts`

Retrieve a list of posts from a specific map with pagination and filtering support.

**Parameters:**

- `mapId` (required): ID of the map to retrieve posts from
- `limit` (optional): Maximum number of posts to return (1-100, default: 20)
- `offset` (optional): Number of posts to skip for pagination (default: 0)
- `orderBy` (optional): How to order results - "trending", "newest", "oldest", "distance" (default: "trending")
- `centerLatitude` (optional): Latitude for distance-based ordering (required if orderBy is "distance")
- `centerLongitude` (optional): Longitude for distance-based ordering (required if orderBy is "distance")
- `filterActionIds` (optional): Filter posts by specific action IDs

**Example Usage with Claude:**

```
"Show me all posts on map 123"
"List the newest 10 posts from map 456"
"Show me posts on map 789 ordered by distance from coordinates 40.7128, -74.0060"
"Get posts from map 123 filtered by action IDs 10, 20, 30"
```

### `list_maps`

Retrieve a list of maps belonging to the authenticated user with pagination support.

**Parameters:**

- `limit` (optional): Maximum number of maps to return (1-100, default: 20)
- `offset` (optional): Number of maps to skip for pagination (default: 0)

**Example Usage with Claude:**

```
"Show me all my maps"
"List my first 10 maps"
"Show me maps 21-40" (offset: 20, limit: 20)
```

## Development

### Setup

```bash
git clone https://github.com/YouMap-app/youmap-mcp.git
cd youmap-mcp
npm install
```

### Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test the MCP Server

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | npm run dev
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License

## Support

For support, please visit [https://github.com/YouMap-app/youmap-mcp/issues](https://github.com/YouMap-app/youmap-mcp/issues)
