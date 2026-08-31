# Diagram library API + MCP (thin HTTP client)

**Date:** 2026-08-31  
**Status:** approved (approach A)

## Goal

Agents and scripts can list, create, update, and delete library diagrams. Cursor agents use MCP. Other clients use HTTP.

## Decisions

| Topic | Choice |
|-------|--------|
| Surface | Both HTTP and MCP |
| Deployment | Local and remote (`ARCHIFY_API_BASE`) |
| Auth (v1) | None; private network / VPN only; document the risk |
| Architecture | Thin stdio MCP calls existing gallery REST API |

## Architecture

```
Cursor / agent          Scripts / curl / UI
        │                        │
        ▼                        ▼
 archify-mcp (stdio)      HTTP client
        │                        │
        └────────┬───────────────┘
                 ▼
    archify-app-server :8787
         REST + static UI
                 │
                 ▼
         var/library (JSON + HTML)
```

- Canonical write path: REST in `scripts/archify-app-server.mjs`
- MCP: `scripts/archify-mcp.mjs` (stdio JSON-RPC), env `ARCHIFY_API_BASE` (default `http://127.0.0.1:8787`)
- Discovery: `GET /api` returns route catalog + no-auth warning

## HTTP additions

- `GET /api` — machine-readable catalog of methods, paths, bodies, and security note
- Existing routes unchanged: health, diagrams CRUD, templates

## MCP tools

| Tool | HTTP |
|------|------|
| `describe_api` | `GET /api` |
| `health` | `GET /api/health` |
| `list_diagrams` | `GET /api/diagrams` |
| `get_diagram` | `GET /api/diagrams/:id` |
| `list_templates` | `GET /api/templates` |
| `create_diagram` | `POST /api/diagrams` |
| `update_diagram` | `PUT /api/diagrams/:id` |
| `delete_diagram` | `DELETE /api/diagrams/:id` |

## Out of scope (v1)

- Auth tokens / TLS termination
- MCP Streamable HTTP transport inside the app server
- Extracting CRUD into a shared library module

## Cursor config (example)

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

For a remote gallery, set `ARCHIFY_API_BASE` to that host (reachable on the private network).
