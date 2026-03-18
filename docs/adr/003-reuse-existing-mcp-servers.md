# ADR-003: Reuse Existing MCP Servers

## Status

Accepted

## Context

The watch command needs web search capabilities to discover trending repos across GitHub, Hacker News, Reddit, Product Hunt, and other sources. We considered building a custom MCP server vs. reusing existing ones.

## Decision

Reuse existing, well-maintained MCP servers: **exa**, **brave-search**, and **tavily**. These are configured as stdio MCP servers in `.kiro/settings/mcp.json` using the same `npx -y` pattern established in personal-plugins.

- **exa** (`exa-mcp-server`): Strong at code/repository discovery, GitHub-specific search
- **brave-search** (`@brave/brave-search-mcp-server`): Good for HN, Reddit, Product Hunt, general web
- **tavily** (`tavily-mcp@latest`): Research-focused, good for blog posts, dev.to, announcements

No custom MCP server is built. The Kiro agent's steering file instructs it on how to use these tools effectively for repo discovery.

Since API keys are sensitive, the repo ships a `.mcp.json.example` with placeholder values. Users copy it to `.kiro/settings/mcp.json` and fill in their own keys.

## Consequences

- Zero custom MCP code to maintain
- Leverages battle-tested search APIs
- Users need their own API keys (exa, brave, tavily)
- The Kiro agent's steering file is the "glue" that orchestrates the search strategy
- Adding new search sources means adding a new MCP server to the config, not writing code
