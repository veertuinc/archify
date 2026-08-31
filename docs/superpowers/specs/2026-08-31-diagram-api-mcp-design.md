# Diagram library API + MCP (thin HTTP client)

**Date:** 2026-08-31  
**Status:** approved (approach A + Streamable HTTP)

## Goal

Agents and scripts can list, create, update, and delete library diagrams. Cursor agents use MCP (stdio or remote HTTP). Other clients use HTTP.

## Decisions

| Topic | Choice |
|-------|--------|
| Surface | Both HTTP and MCP |
| Deployment | Local and remote |
| Auth (v1) | None; private network / VPN only; document the risk |
| Architecture | Gallery REST is canonical; MCP wraps it |
| Remote MCP | Streamable HTTP at `/mcp` on the gallery server (no SSH) |

## Architecture

```
Cursor (remote URL)          Cursor (stdio)           Scripts / UI
        │                           │                      │
        ▼                           ▼                      ▼
   POST/GET /mcp              archify-mcp.mjs           REST /api/*
        │                           │                      │
        └─────────────┬─────────────┴──────────────────────┘
                      ▼
           archify-app-server :8787
                REST + /mcp + static UI
                      │
                      ▼
              var/library (JSON + HTML)
```

- Canonical write path: REST in `scripts/archify-app-server.mjs`
- Shared tools: `scripts/lib/archify-mcp-core.mjs`
- Stdio: `scripts/archify-mcp.mjs` + `ARCHIFY_API_BASE`
- Remote: `GET|POST|DELETE /mcp` (Streamable HTTP + SSE stream)
- Discovery: `GET /api` includes MCP URLs

## Cursor config

Remote (Poweredge, no SSH):

```json
{
  "mcpServers": {
    "archify": {
      "url": "http://10.8.1.200:8787/mcp"
    }
  }
}
```

Local stdio:

```json
{
  "mcpServers": {
    "archify": {
      "command": "node",
      "args": ["/absolute/path/to/archify/scripts/archify-mcp.mjs"],
      "env": {
        "ARCHIFY_API_BASE": "http://127.0.0.1:8787"
      }
    }
  }
}
```

## Out of scope (still)

- Auth tokens / TLS termination
- Extracting CRUD into a shared non-HTTP library module
