#!/usr/bin/env node

/**
 * Test script for YouMap MCP Server
 *
 * This script verifies that:
 * 1. Authentication works correctly
 * 2. API connectivity is established
 * 3. Basic API calls can be made
 *
 * Usage: node test.js
 *
 * Environment variables required:
 * - YOUMAP_CLIENT_ID
 * - YOUMAP_CLIENT_SECRET
 * - YOUMAP_BASE_URL (optional)
 */

const { YouMapClient } = require("./dist/client");

async function testAuthentication() {
  console.log("🧪 Testing YouMap MCP Server Authentication...\n");

  // Check environment variables
  const clientId = process.env.YOUMAP_CLIENT_ID;
  const clientSecret = process.env.YOUMAP_CLIENT_SECRET;
  const baseURL = process.env.YOUMAP_BASE_URL || "https://youmap.com/api";

  if (!clientId || !clientSecret) {
    console.error("❌ Missing required environment variables:");
    console.error("   - YOUMAP_CLIENT_ID");
    console.error("   - YOUMAP_CLIENT_SECRET");
    console.error("\nPlease set these environment variables and try again.");
    process.exit(1);
  }

  console.log("✅ Environment variables found");
  console.log(`📍 Base URL: ${baseURL}\n`);

  try {
    // Initialize client
    const client = new YouMapClient({
      baseURL,
      clientId,
      clientSecret,
    });

    console.log("🔐 Testing authentication...");

    // Test authentication by making a simple API call
    // We'll try to list maps which requires authentication
    const response = await client.get("/maps", { limit: 1, offset: 0 });

    console.log("✅ Authentication successful!");
    console.log(
      `📊 API Response: ${response.maps ? response.maps.length : 0} maps found`
    );

    if (response.maps && response.maps.length > 0) {
      console.log(`📋 First map: "${response.maps[0].name}"`);
    }

    console.log("\n🎉 YouMap MCP Server is ready to use!");
  } catch (error) {
    console.error("❌ Authentication failed:");
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(
        `   Response: ${JSON.stringify(error.response.data, null, 2)}`
      );
    }

    console.error("\n💡 Troubleshooting:");
    console.error("   1. Verify your client ID and secret are correct");
    console.error("   2. Check that your credentials have API access");
    console.error("   3. Ensure the base URL is correct");
    console.error("   4. Check your network connectivity");

    process.exit(1);
  }
}

// Run the test
testAuthentication().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
