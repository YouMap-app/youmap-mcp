import axios from "axios";
export const TOOLS = [
    {
        name: "test",
        description: "test",
        inputSchema: {
            type: "string",
        },
        handler: async (args, client) => {
            console.log("test");
        },
    },
    {
        name: "create_map",
        description: "Create a new map for a user. Maps are spaces where users can add posts, places, and organize content geographically.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Name of the map (3-50 characters)",
                    minLength: 3,
                    maxLength: 50,
                },
                description: {
                    type: "string",
                    description: "Description of the map (5-500 characters, optional)",
                    minLength: 5,
                    maxLength: 500,
                },
                accessLevel: {
                    type: "string",
                    enum: ["public", "inviteOnly", "private"],
                    description: "Access level: public (everyone can access), inviteOnly (invite specific users), private (only you)",
                    default: "public",
                },
                coverImageFromUrl: {
                    type: "string",
                    description: "Cover image URL (e.g., http://example.com/image.jpg). To get the image URL, use another action: generate_image. Always try to include image for map.",
                },
                invitedUserIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "List of user IDs to invite (only used when accessLevel is inviteOnly)",
                },
                categoryIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "Category IDs for the map (1-3 categories, defaults to [13])",
                    minItems: 1,
                    maxItems: 3,
                    default: [13],
                },
                readonly: {
                    type: "boolean",
                    description: "Set to true if you don't want other users to post on this map",
                    default: false,
                },
                boundingBox: {
                    type: "object",
                    description: "Coordinates for the initial map view",
                    properties: {
                        north: { type: "number", description: "North latitude" },
                        south: { type: "number", description: "South latitude" },
                        east: { type: "number", description: "East longitude" },
                        west: { type: "number", description: "West longitude" },
                    },
                },
            },
            required: ["name"],
        },
        handler: async (args, client) => {
            try {
                const mapData = {
                    name: args.name,
                    description: args.description,
                    accessLevel: args.accessLevel || "public",
                    coverImageFromUrl: args.coverImageFromUrl,
                    invitedUserIds: args.invitedUserIds || [],
                    categoryIds: args.categoryIds || [13],
                    readonly: args.readonly || false,
                    boundingBox: args.boundingBox,
                    contentOrigin: "PublicAPI",
                };
                const result = await client.post("/api/v1/map", mapData);
                return {
                    success: true,
                    message: `Successfully created map: "${result.name}"`,
                    map: {
                        id: result.id,
                        name: result.name,
                        description: result.description,
                        coverImage: result.coverImage,
                        accessLevel: result.accessLevel,
                        isReadonly: result.isReadonly,
                        categoryIds: result.categoryIds,
                        createdAt: result.createdAt,
                        url: `https://youmap.com/map/${result.id}`,
                    },
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your YOUMAP_API_KEY.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to create maps.");
                }
                else if (error.response?.status === 400) {
                    const errorDetails = error.response.data?.message || "Invalid request data";
                    throw new Error(`Validation error: ${errorDetails}`);
                }
                else {
                    throw new Error(`Failed to create map: ${error.message}`);
                }
            }
        },
    },
    {
        name: "list_maps",
        description: "Retrieve a list of maps belonging to the authenticated user with pagination support.",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Maximum number of maps to return (1-100, default: 20)",
                    minimum: 1,
                    maximum: 100,
                    default: 20,
                },
                offset: {
                    type: "number",
                    description: "Number of maps to skip for pagination (default: 0)",
                    minimum: 0,
                    default: 0,
                },
            },
        },
        handler: async (args, client) => {
            try {
                const params = {
                    limit: args.limit || 20,
                    offset: args.offset || 0,
                };
                const result = await client.get("/api/v1/map", params);
                return {
                    success: true,
                    message: `Found ${result.count} map(s)`,
                    pagination: {
                        total: result.count,
                        limit: params.limit,
                        offset: params.offset,
                        hasMore: params.offset + params.limit < result.count,
                    },
                    maps: result.maps.map((map) => ({
                        id: map.id,
                        name: map.name,
                        description: map.description,
                        coverImage: map.coverImage,
                        isReadonly: map.isReadonly,
                        public: map.public,
                        inviteEnabled: map.inviteEnabled,
                        categoryIds: map.categoryIds,
                        createdAt: map.createdAt,
                        updatedAt: map.updatedAt,
                        url: `https://youmap.com/map/${map.id}`,
                    })),
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your YOUMAP_API_KEY.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to list maps.");
                }
                else {
                    throw new Error(`Failed to list maps: ${error.message}`);
                }
            }
        },
    },
    {
        name: "create_post",
        description: "Create a new post on a map. Posts are content items that users can place on maps at specific geographic locations. When creating post with image, NEVER use generate_image action. Use search_image instead.",
        inputSchema: {
            type: "object",
            properties: {
                mapId: {
                    type: "number",
                    description: "ID of the map where the post will be created",
                },
                name: {
                    type: "string",
                    description: "Name/title of the post (required for most post types)",
                    maxLength: 100,
                },
                description: {
                    type: "string",
                    description: "Description or content of the post (max 500 characters)",
                    maxLength: 500,
                },
                latitude: {
                    type: "number",
                    description: "Latitude coordinate where the post will be placed",
                    minimum: -90,
                    maximum: 90,
                },
                longitude: {
                    type: "number",
                    description: "Longitude coordinate where the post will be placed",
                    minimum: -180,
                    maximum: 180,
                },
                actionId: {
                    type: "number",
                    description: "ID of the action/template to use for this post. Always use the newest/latest version of the action when creating new posts.",
                },
                address: {
                    type: "string",
                    description: "Optional street address for the location",
                },
                placeId: {
                    type: "string",
                    description: "Optional place ID from mapping services (Google Places, etc.)",
                },
                saveAsTemplate: {
                    type: "boolean",
                    description: "Whether to save this post as a template for future use",
                    default: false,
                },
                contentOrigin: {
                    type: "string",
                    enum: ["App", "PublicAPI"],
                    description: "Origin of the content",
                    default: "PublicAPI",
                },
                fields: {
                    type: "object",
                    description: "Custom field values based on the action template",
                    properties: {
                        textFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    value: { type: "string" },
                                },
                            },
                        },
                        websiteFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    text: { type: "string" },
                                },
                            },
                        },
                        mediaFields: {
                            type: "array",
                            items: {
                                type: "object",
                                description: "Pass URLs of media here to add media to post. To get images for posts, use the search_image action",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    filesFromUrl: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                url: {
                                                    type: "string",
                                                    description: "URL of the media file",
                                                },
                                                type: {
                                                    type: "string",
                                                    enum: ["image", "video"],
                                                    description: "Type of media - either 'image' or 'video'",
                                                },
                                            },
                                            required: ["url", "type"],
                                        },
                                    },
                                },
                            },
                        },
                        ratingFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    score: { type: "number", minimum: 1, maximum: 5 },
                                },
                            },
                        },
                        dateFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    startDate: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the date will be taken from this timestamp.',
                                    },
                                    endDate: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the date will be taken from this timestamp',
                                    },
                                    startTime: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the time will be taken from this timestamp.',
                                    },
                                    endTime: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the time will be taken from this timestamp',
                                    },
                                },
                            },
                        },
                        selectFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    options: {
                                        type: "array",
                                        items: {
                                            type: "number",
                                        },
                                    },
                                },
                            },
                        },
                        valueSliderFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    value: { type: "number" },
                                },
                            },
                        },
                        optionSliderFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    index: { type: "number" },
                                },
                            },
                        },
                    },
                },
            },
            required: ["mapId", "latitude", "longitude", "actionId"],
        },
        handler: async (args, client) => {
            try {
                const postData = {
                    mapId: args.mapId,
                    name: args.name,
                    description: args.description,
                    lat: args.latitude,
                    lon: args.longitude,
                    actionId: args.actionId,
                    address: args.address,
                    placeId: args.placeId,
                    saveAsTemplate: args.saveAsTemplate || false,
                    contentOrigin: args.contentOrigin || "PublicAPI",
                    fields: args.fields,
                };
                const result = await client.post("/api/v1/post", postData);
                return {
                    success: true,
                    message: `Successfully created post: "${result.name || "Untitled"}"`,
                    post: {
                        id: result.id,
                        name: result.name,
                        description: result.description,
                        latitude: result.lat,
                        longitude: result.lon,
                        mapId: result.mapId,
                        actionId: result.actionId,
                        userId: result.userId,
                        address: result.address,
                        isEditable: result.isEditable,
                        isPublic: result.isPublic,
                        isQuickPost: result.isQuickPost,
                        createdAt: result.createdAt,
                        updatedAt: result.updatedAt,
                        url: `https://youmap.com/post/${result.id}`,
                        mapUrl: `https://youmap.com/map/${result.mapId}`,
                    },
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to create posts on this map.");
                }
                else if (error.response?.status === 400) {
                    const errorDetails = error.response.data?.message || "Invalid request data";
                    throw new Error(`Validation error: ${errorDetails}`);
                }
                else if (error.response?.status === 404) {
                    throw new Error("Map not found. Please check the mapId and ensure the map exists.");
                }
                else {
                    throw new Error(`Failed to create post: ${error.message}`);
                }
            }
        },
    },
    {
        name: "list_posts",
        description: "Retrieve a list of posts from a specific map with pagination and filtering support.",
        inputSchema: {
            type: "object",
            properties: {
                mapId: {
                    type: "number",
                    description: "ID of the map to retrieve posts from",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of posts to return (1-100, default: 20)",
                    minimum: 1,
                    maximum: 100,
                    default: 20,
                },
                offset: {
                    type: "number",
                    description: "Number of posts to skip for pagination (default: 0)",
                    minimum: 0,
                    default: 0,
                },
                orderBy: {
                    type: "string",
                    enum: ["trending", "newest", "oldest", "distance"],
                    description: "How to order the results (default: trending)",
                    default: "trending",
                },
                centerLatitude: {
                    type: "number",
                    description: "Latitude for distance-based ordering (required if orderBy is 'distance')",
                    minimum: -90,
                    maximum: 90,
                },
                centerLongitude: {
                    type: "number",
                    description: "Longitude for distance-based ordering (required if orderBy is 'distance')",
                    minimum: -180,
                    maximum: 180,
                },
                filterActionIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "Filter posts by specific action IDs (optional)",
                },
            },
            required: ["mapId"],
        },
        handler: async (args, client) => {
            try {
                const params = {
                    limit: args.limit || 20,
                    offset: args.offset || 0,
                    orderBy: args.orderBy || "trending",
                };
                if (args.orderBy === "distance") {
                    if (!args.centerLatitude || !args.centerLongitude) {
                        throw new Error("centerLatitude and centerLongitude are required when orderBy is 'distance'");
                    }
                    params.position = {
                        lat: args.centerLatitude,
                        lon: args.centerLongitude,
                    };
                }
                if (args.filterActionIds && args.filterActionIds.length > 0) {
                    params.filterActionIds = args.filterActionIds;
                }
                const result = await client.get(`/api/v1/map/${args.mapId}/posts`, params);
                return {
                    success: true,
                    message: `Found ${result.count} post(s) on map ${args.mapId}`,
                    pagination: {
                        total: result.count,
                        limit: params.limit,
                        offset: params.offset,
                        hasMore: params.offset + params.limit < result.count,
                    },
                    posts: result.posts.map((post) => ({
                        id: post.id,
                        name: post.name,
                        description: post.description,
                        latitude: post.lat,
                        longitude: post.lon,
                        mapId: post.mapId,
                        userId: post.userId,
                        actionId: post.actionId,
                        actionName: post.actionName,
                        emoji: post.emoji,
                        address: post.address,
                        isEditable: post.isEditable,
                        isPublic: post.isPublic,
                        isQuickPost: post.isQuickPost,
                        voteCount: post.voteCount,
                        commentsCount: post.commentsCount,
                        categoryIds: post.categoryIds,
                        createdAt: post.createdAt,
                        updatedAt: post.updatedAt,
                        score: post.score,
                        url: `https://youmap.com/post/${post.id}`,
                        mapUrl: `https://youmap.com/map/${post.mapId}`,
                    })),
                    mapInfo: {
                        id: args.mapId,
                        url: `https://youmap.com/map/${args.mapId}`,
                    },
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to view posts on this map.");
                }
                else if (error.response?.status === 404) {
                    throw new Error("Map not found. Please check the mapId and ensure the map exists.");
                }
                else {
                    throw new Error(`Failed to list posts: ${error.message}`);
                }
            }
        },
    },
    {
        name: "create_action",
        description: "Create a new action (post template) that defines the structure for posts. Actions serve as blueprints that specify what fields and content types posts can contain.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Name of the action/post template (3-50 characters)",
                    minLength: 3,
                    maxLength: 50,
                },
                emoji: {
                    type: "string",
                    description: "Emoji that represents this action (default: ':speech_balloon:')",
                    default: ":speech_balloon:",
                },
                mapId: {
                    type: "number",
                    description: "ID of the map this action belongs to",
                },
                borderColor: {
                    type: "string",
                    description: "Hex color for the action border (7 characters, e.g., '#FF5733'). borderColor must be one of the following values: #8337EC, #E43AFF, #A86EFF, #87A2FB, #64DFDF, #FF006E, #FF63C1, #FF7D00, #FFAB00, #FFCB00, #C0E218, #00D880, #8DCCFC, #4EA6FD, #802AFF, #3E7C17, #29B23F, #1B939F, #342EAD, #8A9297, #4C5F68, #232932",
                    pattern: "^#[0-9A-Fa-f]{6}$",
                },
                duration: {
                    type: "string",
                    enum: [
                        "Forever",
                        "BasedOnDateField",
                        "TwoMinutes",
                        "HalfHour",
                        "OneHour",
                        "FourHours",
                        "OneDay",
                        "TwoDays",
                        "ThreeDays",
                        "SevenDays",
                    ],
                    description: "How long posts created with this action remain active (default: 'Forever')",
                    default: "Forever",
                },
                order: {
                    type: "number",
                    description: "Display order among other actions on the map",
                },
                fields: {
                    type: "object",
                    description: "Define the structure and fields for posts created with this action. Only 3 fields can be featured. Only 2 fields can be featured if there is a featured media field. Featured fields should be placed at the first positions on field list",
                    properties: {
                        textFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    placeholder: {
                                        type: "string",
                                        description: "Placeholder text",
                                    },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    maxLength: {
                                        type: "number",
                                        description: "Maximum text length",
                                        default: 500,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        mediaFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    maxImages: {
                                        type: "number",
                                        description: "Maximum number of images",
                                        default: 5,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        websiteFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    placeholder: {
                                        type: "string",
                                        description: "Placeholder text",
                                    },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        ratingFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    maxRating: {
                                        type: "number",
                                        description: "Maximum rating (1-10)",
                                        default: 5,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        valueSliderFields: {
                            type: "array",
                            description: "Value slider where people can choose a value from with a set range (min to max)",
                            items: {
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    min: {
                                        type: "number",
                                        description: "Required field",
                                    },
                                    max: {
                                        type: "number",
                                        description: "Required field",
                                    },
                                },
                            },
                            required: ["label", "order"],
                        },
                        optionSliderFields: {
                            type: "array",
                            description: "A field where people will be able to choose options from.",
                            items: {
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    options: {
                                        type: "array",
                                        description: "Required field",
                                        items: {
                                            type: "string",
                                        },
                                        minItems: 2,
                                        maxItems: 4,
                                        uniqueItems: true,
                                    },
                                },
                            },
                            required: ["label", "order"],
                        },
                        dateField: {
                            type: "object",
                            description: "Single date field for the action",
                            properties: {
                                label: { type: "string", description: "Field label" },
                                order: { type: "number", description: "Field order" },
                                featured: {
                                    type: "boolean",
                                    description: "Show in featured view",
                                    default: false,
                                },
                                required: {
                                    type: "boolean",
                                    description: "Required field",
                                    default: false,
                                },
                            },
                            required: ["label", "order"],
                        },
                        selectField: {
                            type: "object",
                            description: "Values the user will be able to choose from",
                            properties: {
                                label: { type: "string", description: "Field label" },
                                order: { type: "number", description: "Field order" },
                                featured: {
                                    type: "boolean",
                                    description: "Show in featured view",
                                    default: false,
                                },
                                required: {
                                    type: "boolean",
                                    description: "Required field",
                                    default: false,
                                },
                                multiselect: {
                                    type: "boolean",
                                    description: "Defines if user will be able to choose multiple selections",
                                },
                                options: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            text: {
                                                type: "string",
                                                description: "Required field",
                                            },
                                            emoji: {
                                                type: "string",
                                                description: "Not required. Emoji in unicode format, e.g :smile:",
                                            },
                                        },
                                    },
                                },
                            },
                            required: ["label", "order", "multiselect", "options"],
                        },
                    },
                },
            },
            required: ["name", "mapId"],
        },
        handler: async (args, client) => {
            try {
                const actionData = {
                    name: args.name,
                    emoji: args.emoji || ":speech_balloon:",
                    mapId: args.mapId,
                    borderColor: args.borderColor,
                    duration: args.duration || "Forever",
                    order: args.order,
                    fields: args.fields,
                };
                const result = await client.post("/api/v1/post-template", actionData);
                return {
                    success: true,
                    message: `Successfully created action: "${result.name}"`,
                    action: {
                        id: result.id,
                        name: result.name,
                        emoji: result.emoji,
                        mapId: result.mapId,
                        borderColor: result.borderColor,
                        duration: result.duration,
                        order: result.order,
                        isDisabled: result.isDisabled,
                        createdAt: result.createdAt,
                        updatedAt: result.updatedAt,
                        fields: result.fields,
                        url: `https://youmap.com/action/${result.id}`,
                        mapUrl: `https://youmap.com/map/${result.mapId}`,
                    },
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to create actions on this map.");
                }
                else if (error.response?.status === 400) {
                    const errorDetails = error.response.data?.message || "Invalid request data";
                    throw new Error(`Validation error: ${errorDetails}`);
                }
                else if (error.response?.status === 404) {
                    throw new Error("Map not found. Please check the mapId and ensure the map exists.");
                }
                else {
                    throw new Error(`Failed to create action: ${error.message}`);
                }
            }
        },
    },
    {
        name: "list_actions",
        description: "Retrieve a list of actions (post templates) from a specific map. Actions define the structure and fields available for creating posts.",
        inputSchema: {
            type: "object",
            properties: {
                mapId: {
                    type: "number",
                    description: "ID of the map to retrieve actions from",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of actions to return (1-100, default: 20)",
                    minimum: 1,
                    maximum: 100,
                    default: 20,
                },
                offset: {
                    type: "number",
                    description: "Number of actions to skip for pagination (default: 0)",
                    minimum: 0,
                    default: 0,
                },
                orderBy: {
                    type: "string",
                    enum: ["id", "name", "emoji", "created_at", "updated_at", "order"],
                    description: "How to order the results (default: 'order')",
                    default: "order",
                },
                sort: {
                    type: "string",
                    enum: ["asc", "desc"],
                    description: "Sort direction (default: 'asc')",
                    default: "asc",
                },
                enabledOnly: {
                    type: "boolean",
                    description: "Only return enabled actions (default: true)",
                    default: true,
                },
                phrase: {
                    type: "string",
                    description: "Search phrase to filter actions by name",
                },
            },
            required: ["mapId"],
        },
        handler: async (args, client) => {
            try {
                const params = {
                    limit: args.limit || 20,
                    offset: args.offset || 0,
                    orderBy: args.orderBy || "order",
                    sort: args.sort || "asc",
                    enabledOnly: args.enabledOnly !== false,
                };
                if (args.phrase) {
                    params.phrase = args.phrase;
                }
                const result = await client.get(`/api/v1/map/${args.mapId}/post-templates`, params);
                return {
                    success: true,
                    message: `Found ${result.count} action(s) on map ${args.mapId}`,
                    pagination: {
                        total: result.count,
                        limit: params.limit,
                        offset: params.offset,
                        hasMore: params.offset + params.limit < result.count,
                    },
                    actions: result.postTemplates.map((action) => ({
                        id: action.id,
                        name: action.name,
                        emoji: action.emoji,
                        mapId: action.mapId,
                        borderColor: action.borderColor,
                        duration: action.duration,
                        order: action.order,
                        isDisabled: action.isDisabled,
                        createdAt: action.createdAt,
                        updatedAt: action.updatedAt,
                        fields: action.fields,
                        version: action.latestVersion,
                        url: `https://youmap.com/action/${action.id}`,
                        mapUrl: `https://youmap.com/map/${action.mapId}`,
                    })),
                    mapInfo: {
                        id: args.mapId,
                        url: `https://youmap.com/map/${args.mapId}`,
                    },
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to view actions on this map.");
                }
                else if (error.response?.status === 404) {
                    throw new Error("Map not found. Please check the mapId and ensure the map exists.");
                }
                else {
                    throw new Error(`Failed to list actions: ${error.message}`);
                }
            }
        },
    },
    {
        name: "update_action",
        description: "Update an existing action (post template). You should always update the newest/latest version of an action. Use get_action_versions to find the latest version number first if needed.",
        inputSchema: {
            type: "object",
            properties: {
                actionId: {
                    type: "number",
                    description: "ID of the action to update",
                },
                version: {
                    type: "number",
                    description: "Version number to update (should be the latest version). Get this from get_action_versions if needed.",
                },
                name: {
                    type: "string",
                    description: "New name of the action/post template (3-50 characters)",
                    minLength: 3,
                    maxLength: 50,
                },
                emoji: {
                    type: "string",
                    description: "New emoji that represents this action",
                },
                borderColor: {
                    type: "string",
                    description: "New hex color for the action border (7 characters, e.g., '#FF5733')",
                    pattern: "^#[0-9A-Fa-f]{6}$",
                },
                duration: {
                    type: "string",
                    enum: [
                        "Forever",
                        "BasedOnDateField",
                        "TwoMinutes",
                        "HalfHour",
                        "OneHour",
                        "FourHours",
                        "OneDay",
                        "TwoDays",
                        "ThreeDays",
                        "SevenDays",
                    ],
                    description: "How long posts created with this action remain active",
                },
                autoPublish: {
                    type: "boolean",
                    description: "Whether to automatically publish the updated version (default: false)",
                    default: false,
                },
                fields: {
                    type: "object",
                    description: "Define the structure and fields for posts created with this action. Only 3 fields can be featured. Only 2 fields can be featured if there is a featured media field. Featured fields should be placed at the first positions on field list",
                    properties: {
                        textFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    placeholder: {
                                        type: "string",
                                        description: "Placeholder text",
                                    },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    maxLength: {
                                        type: "number",
                                        description: "Maximum text length",
                                        default: 500,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        mediaFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    maxImages: {
                                        type: "number",
                                        description: "Maximum number of images",
                                        default: 5,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        websiteFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    placeholder: {
                                        type: "string",
                                        description: "Placeholder text",
                                    },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        ratingFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    maxRating: {
                                        type: "number",
                                        description: "Maximum rating (1-10)",
                                        default: 5,
                                    },
                                },
                                required: ["label", "order"],
                            },
                        },
                        valueSliderFields: {
                            type: "array",
                            description: "Value slider where people can choose a value from with a set range (min to max)",
                            items: {
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    min: {
                                        type: "number",
                                        description: "Required field",
                                    },
                                    max: {
                                        type: "number",
                                        description: "Required field",
                                    },
                                },
                            },
                            required: ["label", "order"],
                        },
                        optionSliderFields: {
                            type: "array",
                            description: "A field where people will be able to choose options from.",
                            items: {
                                properties: {
                                    label: { type: "string", description: "Field label" },
                                    order: { type: "number", description: "Field order" },
                                    featured: {
                                        type: "boolean",
                                        description: "Show in featured view",
                                        default: false,
                                    },
                                    required: {
                                        type: "boolean",
                                        description: "Required field",
                                        default: false,
                                    },
                                    options: {
                                        type: "array",
                                        description: "Required field",
                                        items: {
                                            type: "string",
                                        },
                                        minItems: 2,
                                        maxItems: 4,
                                        uniqueItems: true,
                                    },
                                },
                            },
                            required: ["label", "order"],
                        },
                        dateField: {
                            type: "object",
                            description: "Single date field for the action",
                            properties: {
                                label: { type: "string", description: "Field label" },
                                order: { type: "number", description: "Field order" },
                                featured: {
                                    type: "boolean",
                                    description: "Show in featured view",
                                    default: false,
                                },
                                required: {
                                    type: "boolean",
                                    description: "Required field",
                                    default: false,
                                },
                            },
                            required: ["label", "order"],
                        },
                        selectField: {
                            type: "object",
                            description: "Values the user will be able to choose from",
                            properties: {
                                label: { type: "string", description: "Field label" },
                                order: { type: "number", description: "Field order" },
                                featured: {
                                    type: "boolean",
                                    description: "Show in featured view",
                                    default: false,
                                },
                                required: {
                                    type: "boolean",
                                    description: "Required field",
                                    default: false,
                                },
                                multiselect: {
                                    type: "boolean",
                                    description: "Defines if user will be able to choose multiple selections",
                                },
                                options: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            text: {
                                                type: "string",
                                                description: "Required field",
                                            },
                                            emoji: {
                                                type: "string",
                                                description: "Not required. Emoji in unicode format, e.g :smile:",
                                            },
                                        },
                                    },
                                },
                            },
                            required: ["label", "order", "multiselect", "options"],
                        },
                    },
                },
            },
            required: ["actionId", "version", "fields"],
        },
        handler: async (args, client) => {
            try {
                const updateData = {
                    version: args.version,
                    fields: args.fields,
                    autoPublish: args.autoPublish || false,
                };
                if (args.name)
                    updateData.name = args.name;
                if (args.emoji)
                    updateData.emoji = args.emoji;
                if (args.borderColor)
                    updateData.borderColor = args.borderColor;
                if (args.duration)
                    updateData.duration = args.duration;
                const result = await client.put(`/api/v1/post-template/${args.actionId}/v/${args.version}`, updateData);
                return {
                    success: true,
                    message: `Successfully updated action ${args.actionId} version ${args.version}`,
                    action: {
                        id: result.id,
                        name: result.name,
                        emoji: result.emoji,
                        mapId: result.mapId,
                        borderColor: result.borderColor,
                        duration: result.duration,
                        order: result.order,
                        isDisabled: result.isDisabled,
                        createdAt: result.createdAt,
                        updatedAt: result.updatedAt,
                        fields: result.fields,
                        version: result.version,
                        isPublished: result.isPublished,
                        publishedAt: result.publishedAt,
                        url: `https://youmap.com/action/${result.id}`,
                        mapUrl: `https://youmap.com/map/${result.mapId}`,
                    },
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to update this action.");
                }
                else if (error.response?.status === 400) {
                    const errorDetails = error.response.data?.message || "Invalid request data";
                    throw new Error(`Validation error: ${errorDetails}`);
                }
                else if (error.response?.status === 404) {
                    throw new Error(`Action not found. Please check the actionId ${args.actionId} and version ${args.version}.`);
                }
                else {
                    throw new Error(`Failed to update action: ${error.message}`);
                }
            }
        },
    },
    {
        name: "update_post",
        description: "Update an existing post. You can modify the post's content, location, fields, and other properties.",
        inputSchema: {
            type: "object",
            properties: {
                postId: {
                    type: "number",
                    description: "ID of the post to update",
                },
                name: {
                    type: "string",
                    description: "New name/title of the post",
                    maxLength: 100,
                },
                description: {
                    type: "string",
                    description: "New description or content of the post (max 500 characters)",
                    maxLength: 500,
                },
                latitude: {
                    type: "number",
                    description: "New latitude coordinate for the post",
                    minimum: -90,
                    maximum: 90,
                },
                longitude: {
                    type: "number",
                    description: "New longitude coordinate for the post",
                    minimum: -180,
                    maximum: 180,
                },
                actionId: {
                    type: "number",
                    description: "New action/template ID to use for this post",
                },
                address: {
                    type: "string",
                    description: "New address for the location",
                },
                placeId: {
                    type: "string",
                    description: "New place ID from mapping services",
                },
                deletedImageIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "Array of image IDs to delete from the post",
                },
                createdFields: {
                    type: "object",
                    description: "Added fields",
                    properties: {
                        textFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    value: { type: "string" },
                                },
                            },
                        },
                        websiteFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    text: { type: "string" },
                                },
                            },
                        },
                        mediaFields: {
                            type: "array",
                            items: {
                                type: "object",
                                description: "Pass URLs of media here to add media to post. To get images for posts, use the search_image action",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    filesFromUrl: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                url: {
                                                    type: "string",
                                                    description: "URL of the media file",
                                                },
                                                type: {
                                                    type: "string",
                                                    enum: ["image", "video"],
                                                    description: "Type of media - either 'image' or 'video'",
                                                },
                                            },
                                            required: ["url", "type"],
                                        },
                                    },
                                },
                            },
                        },
                        ratingFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    score: { type: "number", minimum: 1, maximum: 5 },
                                },
                            },
                        },
                        dateFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    startDate: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the date will be taken from this timestamp.',
                                    },
                                    endDate: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the date will be taken from this timestamp',
                                    },
                                    startTime: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the time will be taken from this timestamp.',
                                    },
                                    endTime: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the time will be taken from this timestamp',
                                    },
                                },
                            },
                        },
                        selectFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    options: {
                                        type: "array",
                                        items: {
                                            type: "number",
                                        },
                                    },
                                },
                            },
                        },
                        valueSliderFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    value: { type: "number" },
                                },
                            },
                        },
                        optionSliderFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    index: { type: "number" },
                                },
                            },
                        },
                    },
                },
                updatedFields: {
                    type: "object",
                    description: "Custom field values based on the action template",
                    properties: {
                        textFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    value: { type: "string" },
                                },
                            },
                        },
                        websiteFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    text: { type: "string" },
                                },
                            },
                        },
                        mediaFields: {
                            type: "array",
                            items: {
                                type: "object",
                                description: "Pass URLs of media here to add media to post. To get images for posts, use the search_image action",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    filesFromUrl: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                url: {
                                                    type: "string",
                                                    description: "URL of the media file",
                                                },
                                                type: {
                                                    type: "string",
                                                    enum: ["image", "video"],
                                                    description: "Type of media - either 'image' or 'video'",
                                                },
                                            },
                                            required: ["url", "type"],
                                        },
                                    },
                                },
                            },
                        },
                        ratingFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    score: { type: "number", minimum: 1, maximum: 5 },
                                },
                            },
                        },
                        dateFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    startDate: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the date will be taken from this timestamp.',
                                    },
                                    endDate: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the date will be taken from this timestamp',
                                    },
                                    startTime: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the time will be taken from this timestamp.',
                                    },
                                    endTime: {
                                        type: "string",
                                        format: "timestamp",
                                        description: 'Example: "1756771200". Only the time will be taken from this timestamp',
                                    },
                                },
                            },
                        },
                        selectFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    options: {
                                        type: "array",
                                        items: {
                                            type: "number",
                                        },
                                    },
                                },
                            },
                        },
                        valueSliderFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    value: { type: "number" },
                                },
                            },
                        },
                        optionSliderFields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    fieldTypeId: { type: "number" },
                                    index: { type: "number" },
                                },
                            },
                        },
                    },
                },
                deletedFields: {
                    type: "array",
                    items: { type: "number" },
                    description: "Array of field IDs to delete from the post",
                },
            },
            required: ["postId"],
        },
        handler: async (args, client) => {
            try {
                const { postId, ...updateData } = args;
                const cleanUpdateData = Object.fromEntries(Object.entries(updateData).filter(([, value]) => value !== undefined));
                const response = await client.patch(`/api/v1/post/${postId}`, cleanUpdateData);
                return {
                    success: true,
                    data: response.data,
                };
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your access token.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to update this post.");
                }
                else if (error.response?.status === 404) {
                    throw new Error("Post not found. Please check the postId and ensure the post exists.");
                }
                else if (error.response?.status === 400) {
                    throw new Error(`Validation failed: ${error.response?.data?.message || error.message}`);
                }
                else {
                    throw new Error(`Failed to update post: ${error.message}`);
                }
            }
        },
    },
    {
        name: "generate_image",
        description: "Generate an AI image using FLUX PRO 1.1 model based on a text prompt. This tool directly integrates with the Black Forest Labs API to create high-quality, cinematic-style images with automatic prompt enhancement. Requires BFL_API_KEY environment variable to be configured.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "Text prompt describing the image you want to generate. The prompt will be enhanced with cinematic photography styling automatically.",
                    minLength: 1,
                    maxLength: 1000,
                },
                width: {
                    type: "number",
                    description: "Width of the generated image in pixels (default: 1024)",
                    minimum: 256,
                    maximum: 2048,
                    default: 1024,
                },
                height: {
                    type: "number",
                    description: "Height of the generated image in pixels (default: 1024)",
                    minimum: 256,
                    maximum: 2048,
                    default: 1024,
                },
                outputFormat: {
                    type: "string",
                    enum: ["jpeg", "png"],
                    description: "Output format for the generated image (default: jpeg)",
                    default: "jpeg",
                },
            },
            required: ["prompt"],
        },
        handler: async (args, client) => {
            const { prompt, width = 1024, height = 1024, outputFormat = "jpeg", } = args;
            const bflApiKey = process.env.BFL_API_KEY;
            if (!bflApiKey) {
                throw new Error("BFL_API_KEY environment variable is not configured. Please set your Black Forest Labs API key in the MCP server configuration.");
            }
            const enhancePrompt = (topic) => {
                return `Ultra-high-quality cinematic photograph, natural lighting, vibrant yet realistic colors, slightly warm tone, wide depth of field. Composition highlights the subject of the map — the central theme or focus — framed in a way that draws the eye and tells a story about that topic or location. If people appear, they should support the theme, never be the main focus unless integral to the map's subject. Minimal text, no logos. Style blends premium Unsplash/National Geographic photography with subtle editorial polish — sharp focus, rich textures, inviting atmosphere. Always grounded in real-world visual cues for authenticity. The image should evoke curiosity and feel alive, as if captured in the moment by a skilled photographer. The topic of the generated image: ${topic}.`;
            };
            try {
                const enhancedPrompt = enhancePrompt(prompt);
                const generationUrl = "https://api.bfl.ai/v1/flux-pro-1.1";
                const requestBody = {
                    prompt: enhancedPrompt,
                    width: width,
                    height: height,
                    output_format: outputFormat,
                };
                const headers = {
                    accept: "application/json",
                    "x-key": bflApiKey,
                    "Content-Type": "application/json",
                };
                let generationResponse;
                try {
                    generationResponse = await axios.post(generationUrl, requestBody, {
                        headers,
                        timeout: 30000,
                    });
                }
                catch (error) {
                    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                        throw new Error("Timeout while connecting to FLUX API - FLUX did not respond within 30 seconds");
                    }
                    else if (error.code === "ECONNREFUSED" ||
                        error.code === "ENOTFOUND") {
                        throw new Error("Unable to connect to FLUX API - network connection failed");
                    }
                    else if (error.response) {
                        const status = error.response.status;
                        if (status === 401) {
                            throw new Error("FLUX API authentication failed - invalid API key");
                        }
                        else if (status === 402) {
                            throw new Error("FLUX API payment required - insufficient credits");
                        }
                        else if (status === 429) {
                            throw new Error("FLUX API rate limit exceeded - too many active requests");
                        }
                        else {
                            throw new Error(`FLUX API returned error ${status}: ${error.response.data?.detail || error.response.statusText}`);
                        }
                    }
                    else {
                        throw new Error(`Request to FLUX API failed: ${error.message}`);
                    }
                }
                const initialData = generationResponse.data;
                const pollingUrl = initialData.polling_url;
                if (!pollingUrl) {
                    throw new Error("FLUX API did not return a polling URL");
                }
                const maxAttempts = 120;
                let attempt = 0;
                while (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    attempt++;
                    try {
                        const pollResponse = await axios.get(pollingUrl, {
                            headers: {
                                accept: "application/json",
                                "x-key": bflApiKey,
                            },
                            timeout: 10000,
                        });
                        const pollData = pollResponse.data;
                        const status = pollData.status;
                        if (status === "Ready") {
                            const result = pollData.result || {};
                            const imageUrl = result.sample;
                            if (!imageUrl) {
                                throw new Error("FLUX API completed but no image URL found");
                            }
                            return {
                                success: true,
                                data: {
                                    imageUrl: imageUrl,
                                    originalPrompt: prompt,
                                    enhancedPrompt: enhancedPrompt,
                                    model: "FLUX PRO 1.1",
                                    dimensions: `${width}x${height}`,
                                    format: outputFormat.toUpperCase(),
                                    generationTime: `${attempt * 0.5} seconds`,
                                },
                                message: "Image generated successfully using FLUX PRO 1.1",
                            };
                        }
                        else if (status === "Error" || status === "Failed") {
                            const errorMsg = pollData.error || "Unknown error";
                            throw new Error(`FLUX API generation failed: ${errorMsg}`);
                        }
                        else if (status === "Pending" || status === "Task accepted") {
                            continue;
                        }
                        else {
                            throw new Error(`FLUX API returned unknown status: ${status}`);
                        }
                    }
                    catch (error) {
                        if (error.message.includes("FLUX API")) {
                            throw error;
                        }
                        else {
                            throw new Error(`Failed to poll FLUX API: ${error.message}`);
                        }
                    }
                }
                throw new Error("FLUX API generation timed out - image took too long to generate (max 1 minute)");
            }
            catch (error) {
                if (error.message.includes("FLUX API") ||
                    error.message.includes("Timeout") ||
                    error.message.includes("Unable to connect") ||
                    error.message.includes("timed out")) {
                    throw error;
                }
                else {
                    throw new Error(`Unexpected error in image generation: ${error.message}`);
                }
            }
        },
    },
    {
        name: "search_image",
        description: "Search for existing images using SerpAPI and return a high-quality image URL. This tool searches Google Images, filters results for quality, validates accessibility, and falls back to Unsplash if needed. Requires SERP_API_KEY and UNSPLASH_ACCESS_KEY environment variables to be configured.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query for the image (e.g., 'mountain landscape', 'coffee shop interior', 'vintage car')",
                    minLength: 1,
                    maxLength: 200,
                },
            },
            required: ["query"],
        },
        handler: async (args, client) => {
            const { query } = args;
            const serpApiKey = process.env.SERP_API_KEY;
            const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
            if (!serpApiKey) {
                throw new Error("SERP_API_KEY environment variable is not configured. Please set your SerpAPI key in the MCP server configuration.");
            }
            if (!unsplashAccessKey) {
                throw new Error("UNSPLASH_ACCESS_KEY environment variable is not configured. Please set your Unsplash access key in the MCP server configuration.");
            }
            const validateImageUrl = async (url) => {
                try {
                    const response = await fetch(url, {
                        method: "HEAD",
                        signal: AbortSignal.timeout(10000),
                    });
                    if (!response.ok) {
                        return false;
                    }
                    const contentType = response.headers.get("content-type");
                    if (!contentType || !contentType.startsWith("image/")) {
                        return false;
                    }
                    const contentLength = response.headers.get("content-length");
                    if (contentLength) {
                        const size = parseInt(contentLength);
                        if (size < 1024) {
                            return false;
                        }
                        if (size > 5 * 1024 * 1024) {
                            return false;
                        }
                    }
                    return true;
                }
                catch (error) {
                    return false;
                }
            };
            const searchUnsplashImage = async (searchQuery) => {
                try {
                    const searchUrl = "https://api.unsplash.com/search/photos";
                    const params = new URLSearchParams({
                        query: searchQuery,
                        per_page: "20",
                        orientation: "all",
                        order_by: "relevant",
                    });
                    const response = await fetch(`${searchUrl}?${params}`, {
                        headers: {
                            Authorization: `Client-ID ${unsplashAccessKey}`,
                        },
                        signal: AbortSignal.timeout(10000),
                    });
                    if (!response.ok) {
                        return null;
                    }
                    const data = await response.json();
                    const results = data.results || [];
                    if (!results.length) {
                        return null;
                    }
                    const qualityPhotos = [];
                    for (const photo of results) {
                        const width = photo.width || 0;
                        const height = photo.height || 0;
                        const likes = photo.likes || 0;
                        const urls = photo.urls || {};
                        const regularUrl = urls.regular || "";
                        if (width < 800 || height < 600) {
                            continue;
                        }
                        if (likes < 5) {
                            continue;
                        }
                        const description = (photo.description || "").toLowerCase();
                        const altDescription = (photo.alt_description || "").toLowerCase();
                        const watermarkKeywords = [
                            "watermark",
                            "logo",
                            "brand",
                            "copyright",
                            "©",
                            "shutterstock",
                            "getty",
                        ];
                        const hasWatermark = watermarkKeywords.some((keyword) => description.includes(keyword) ||
                            altDescription.includes(keyword));
                        if (hasWatermark) {
                            continue;
                        }
                        qualityPhotos.push({ photo, likes, resolution: width * height });
                    }
                    if (!qualityPhotos.length) {
                        return null;
                    }
                    qualityPhotos.sort((a, b) => b.likes - a.likes || b.resolution - a.resolution);
                    const topCount = Math.max(1, Math.floor(qualityPhotos.length * 0.8));
                    const topPhotos = qualityPhotos.slice(0, topCount);
                    for (let i = topPhotos.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [topPhotos[i], topPhotos[j]] = [topPhotos[j], topPhotos[i]];
                    }
                    for (const photoData of topPhotos) {
                        const urls = photoData.photo.urls || {};
                        for (const size of ["regular", "small"]) {
                            const url = urls[size];
                            if (url && typeof url === "string") {
                                const isValid = await validateImageUrl(url);
                                if (isValid) {
                                    return url;
                                }
                            }
                        }
                    }
                    return null;
                }
                catch (error) {
                    return null;
                }
            };
            try {
                const searchUrl = "https://serpapi.com/search.json";
                const params = new URLSearchParams({
                    q: query,
                    tbm: "isch",
                    api_key: serpApiKey,
                    engine: "google",
                });
                const response = await fetch(`${searchUrl}?${params}`, {
                    signal: AbortSignal.timeout(15000),
                });
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("SerpAPI authentication failed - invalid API key");
                    }
                    else if (response.status === 403) {
                        throw new Error("SerpAPI access forbidden - API key limit exceeded or permissions issue");
                    }
                    else if (response.status === 429) {
                        throw new Error("SerpAPI rate limit exceeded - too many requests");
                    }
                    else {
                        throw new Error(`SerpAPI returned error ${response.status}`);
                    }
                }
                const data = await response.json();
                const images = data.images_results || [];
                if (!images.length) {
                    const unsplashUrl = await searchUnsplashImage(query);
                    if (unsplashUrl) {
                        return { url: unsplashUrl };
                    }
                    throw new Error("No images found for this query from SerpAPI or Unsplash fallback");
                }
                const qualityImages = [];
                for (let i = 0; i < images.length; i++) {
                    const image = images[i];
                    const width = image.original_width || image.thumbnail_width || 0;
                    const height = image.original_height || image.thumbnail_height || 0;
                    const title = (image.title || "").toLowerCase();
                    const source = (image.source || "").toLowerCase();
                    const originalUrl = image.original || "";
                    if (width > 0 && height > 0 && (width < 400 || height < 300)) {
                        continue;
                    }
                    const lowQualitySources = [
                        "pinterest",
                        "tumblr",
                        "blogger",
                        "wordpress",
                        "weebly",
                        "wix",
                        "squarespace",
                        "blogspot",
                    ];
                    if (lowQualitySources.some((sourceKeyword) => source.includes(sourceKeyword))) {
                        continue;
                    }
                    const badTitleKeywords = [
                        "thumbnail",
                        "preview",
                        "small",
                        "icon",
                        "logo",
                        "watermark",
                        "sample",
                        "demo",
                        "placeholder",
                    ];
                    if (badTitleKeywords.some((keyword) => title.includes(keyword))) {
                        continue;
                    }
                    const watermarkSources = [
                        "shutterstock",
                        "getty",
                        "alamy",
                        "dreamstime",
                        "123rf",
                    ];
                    if (watermarkSources.some((stockSite) => source.includes(stockSite))) {
                        continue;
                    }
                    let qualityScore = width * height || 1000000;
                    const qualitySources = [
                        "wikipedia",
                        "wikimedia",
                        "unsplash",
                        "pexels",
                        "pixabay",
                    ];
                    const boostApplied = qualitySources.some((qualitySource) => source.includes(qualitySource));
                    if (boostApplied) {
                        qualityScore *= 2;
                    }
                    qualityImages.push({ index: i, image, qualityScore });
                }
                if (!qualityImages.length) {
                    const unsplashUrl = await searchUnsplashImage(query);
                    if (unsplashUrl) {
                        return { url: unsplashUrl };
                    }
                    throw new Error("No quality images found from SerpAPI after filtering, and Unsplash fallback failed");
                }
                qualityImages.sort((a, b) => b.qualityScore - a.qualityScore);
                const topCount = Math.max(1, Math.floor(qualityImages.length * 0.8));
                const topQualityImages = qualityImages.slice(0, topCount);
                for (let i = topQualityImages.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [topQualityImages[i], topQualityImages[j]] = [
                        topQualityImages[j],
                        topQualityImages[i],
                    ];
                }
                const maxRetries = Math.min(5, topQualityImages.length);
                const usedIndices = new Set();
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    const availableImages = topQualityImages.filter((item) => !usedIndices.has(item.index));
                    if (!availableImages.length) {
                        break;
                    }
                    const { index, image } = availableImages[0];
                    usedIndices.add(index);
                    const url = image.original || image.thumbnail;
                    if (!url) {
                        continue;
                    }
                    const isValid = await validateImageUrl(url);
                    if (isValid) {
                        return { url };
                    }
                    if (attempt === maxRetries - 1) {
                        const unsplashUrl = await searchUnsplashImage(query);
                        if (unsplashUrl) {
                            return { url: unsplashUrl };
                        }
                        throw new Error("SerpAPI returned images but none could be validated as accessible, and Unsplash fallback also failed");
                    }
                }
                throw new Error("SerpAPI returned images but no valid URLs found");
            }
            catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    throw new Error("Request timeout - external image service did not respond in time");
                }
                if (error instanceof Error &&
                    (error.message.includes("SerpAPI") ||
                        error.message.includes("Unsplash") ||
                        error.message.includes("No images found"))) {
                    throw error;
                }
                else {
                    throw new Error(`Unexpected error in image search: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        },
    },
    {
        name: "delete_action",
        description: "Delete an existing action (post template) permanently. This action cannot be undone. The action must be owned by the authenticated user and must be removable (not in use by posts).",
        inputSchema: {
            type: "object",
            properties: {
                actionId: {
                    type: "number",
                    description: "ID of the action to delete",
                },
            },
            required: ["actionId"],
        },
        handler: async (args, client) => {
            try {
                const result = await client.delete(`/api/v1/post-template/${args.actionId}`);
                if (result.success) {
                    return {
                        success: true,
                        message: `Successfully deleted action with ID: ${args.actionId}`,
                        actionId: args.actionId,
                        deletedAt: new Date().toISOString(),
                    };
                }
                else {
                    throw new Error("Failed to delete action - operation returned false");
                }
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to delete this action, or the action is not removable because it's being used by posts.");
                }
                else if (error.response?.status === 404) {
                    throw new Error("Action not found. Please check the actionId and ensure the action exists.");
                }
                else if (error.response?.status === 400) {
                    const errorDetails = error.response.data?.message || "Invalid request data";
                    throw new Error(`Validation error: ${errorDetails}`);
                }
                else {
                    throw new Error(`Failed to delete action: ${error.message}`);
                }
            }
        },
    },
    {
        name: "delete_map",
        description: "Delete an existing map permanently. This action cannot be undone. The map must be owned by the authenticated user. All posts, actions, and associated data on the map will be removed.",
        inputSchema: {
            type: "object",
            properties: {
                mapId: {
                    type: "number",
                    description: "ID of the map to delete",
                },
            },
            required: ["mapId"],
        },
        handler: async (args, client) => {
            try {
                const result = await client.delete(`/api/v1/map/${args.mapId}`);
                if (result.success) {
                    return {
                        success: true,
                        message: `Successfully deleted map with ID: ${args.mapId}`,
                        mapId: args.mapId,
                        deletedAt: new Date().toISOString(),
                    };
                }
                else {
                    throw new Error("Failed to delete map - operation returned false");
                }
            }
            catch (error) {
                if (error.response?.status === 401) {
                    throw new Error("Authentication failed. Please check your credentials.");
                }
                else if (error.response?.status === 403) {
                    throw new Error("Access denied. You don't have permission to delete this map, or you are not the owner of this map.");
                }
                else if (error.response?.status === 404) {
                    throw new Error("Map not found. Please check the mapId and ensure the map exists.");
                }
                else if (error.response?.status === 400) {
                    const errorDetails = error.response.data?.message || "Invalid request data";
                    throw new Error(`Validation error: ${errorDetails}`);
                }
                else {
                    throw new Error(`Failed to delete map: ${error.message}`);
                }
            }
        },
    },
    {
        name: "delete_post",
        description: "Delete an existing post permanently. This action cannot be undone. The post must be owned by the authenticated user or you must have delete permissions on the map.",
        inputSchema: {
            type: "object",
            properties: {
                postId: {
                    type: "number",
                    description: "ID of the post to delete",
                },
            },
            required: ["postId"],
        },
        handler: async (args, client) => {
            try {
                // Validate input
                if (!args.postId || typeof args.postId !== "number") {
                    return {
                        success: false,
                        error: "Post ID is required and must be a number",
                    };
                }
                // Make API request to delete the post
                const response = await client.delete(`/posts/${args.postId}`);
                if (response.success) {
                    return {
                        success: true,
                        message: `Post with ID ${args.postId} has been deleted successfully`,
                        postId: args.postId,
                    };
                }
                else {
                    return {
                        success: false,
                        error: response.error || "Failed to delete post",
                    };
                }
            }
            catch (error) {
                // Handle specific HTTP error responses
                if (error.response) {
                    const status = error.response.status;
                    const message = error.response.data?.message || error.message;
                    switch (status) {
                        case 401:
                            return {
                                success: false,
                                error: "Authentication required. Please check your access token.",
                            };
                        case 403:
                            return {
                                success: false,
                                error: "Access denied. You don't have permission to delete this post.",
                            };
                        case 404:
                            return {
                                success: false,
                                error: `Post with ID ${args.postId} not found.`,
                            };
                        case 400:
                            return {
                                success: false,
                                error: `Bad request: ${message}`,
                            };
                        default:
                            return {
                                success: false,
                                error: `Server error (${status}): ${message}`,
                            };
                    }
                }
                return {
                    success: false,
                    error: `Network error: ${error.message}`,
                };
            }
        },
    },
    {
        name: "update_map",
        description: "Update an existing map's properties such as name, description, access level, categories, and other settings. The map must be owned by the authenticated user.",
        inputSchema: {
            type: "object",
            properties: {
                mapId: {
                    type: "number",
                    description: "ID of the map to update",
                },
                name: {
                    type: "string",
                    description: "New name of the map (3-50 characters)",
                    minLength: 3,
                    maxLength: 50,
                },
                description: {
                    type: "string",
                    description: "New description of the map (5-500 characters)",
                    minLength: 5,
                    maxLength: 500,
                },
                accessLevel: {
                    type: "string",
                    enum: ["public", "inviteOnly", "private"],
                    description: "Access level: public (everyone can access), inviteOnly (invite specific users), private (only you)",
                },
                coverImageFromUrl: {
                    type: "string",
                    description: "New cover image URL (e.g., http://example.com/image.jpg). To get the image URL, use generate_image or search_image actions.",
                },
                invitedUserIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "List of user IDs to invite (only used when accessLevel is inviteOnly)",
                },
                categoryIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "Category IDs for the map (1-3 categories)",
                    minItems: 1,
                    maxItems: 3,
                },
                readonly: {
                    type: "boolean",
                    description: "Set to true if you don't want other users to post on this map",
                },
                boundingBox: {
                    type: "object",
                    description: "Coordinates for the map view",
                    properties: {
                        north: { type: "number", description: "North latitude" },
                        south: { type: "number", description: "South latitude" },
                        east: { type: "number", description: "East longitude" },
                        west: { type: "number", description: "West longitude" },
                    },
                },
            },
            required: ["mapId"],
        },
        handler: async (args, client) => {
            try {
                // Validate input
                if (!args.mapId || typeof args.mapId !== "number") {
                    return {
                        success: false,
                        error: "Map ID is required and must be a number",
                    };
                }
                // Extract mapId and prepare update payload
                const { mapId, ...updateData } = args;
                // Remove any undefined values to avoid sending empty fields
                const cleanUpdateData = Object.entries(updateData)
                    .filter(([_, value]) => value !== undefined)
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
                if (Object.keys(cleanUpdateData).length === 0) {
                    return {
                        success: false,
                        error: "At least one field must be provided for update",
                    };
                }
                // Make API request to update the map
                const response = await client.post(`/maps/${mapId}`, cleanUpdateData);
                if (response.success) {
                    return {
                        success: true,
                        message: `Map with ID ${mapId} has been updated successfully`,
                        map: response.data,
                    };
                }
                else {
                    return {
                        success: false,
                        error: response.error || "Failed to update map",
                    };
                }
            }
            catch (error) {
                // Handle specific HTTP error responses
                if (error.response) {
                    const status = error.response.status;
                    const message = error.response.data?.message || error.message;
                    switch (status) {
                        case 401:
                            return {
                                success: false,
                                error: "Authentication required. Please check your access token.",
                            };
                        case 403:
                            return {
                                success: false,
                                error: "Access denied. You don't have permission to update this map.",
                            };
                        case 404:
                            return {
                                success: false,
                                error: `Map with ID ${args.mapId} not found.`,
                            };
                        case 400:
                            return {
                                success: false,
                                error: `Bad request: ${message}`,
                            };
                        default:
                            return {
                                success: false,
                                error: `Server error (${status}): ${message}`,
                            };
                    }
                }
                return {
                    success: false,
                    error: `Network error: ${error.message}`,
                };
            }
        },
    },
];
//# sourceMappingURL=index.js.map