---
name: x402tool
description: Call x402-protected API endpoints using the x402tool CLI. Use when the user asks to call an x402 API, hit a 402 endpoint, or interact with any x402-protected service. Also use when you encounter a 402 Payment Required response from an API.
---

# x402tool — CLI for x402-Protected APIs

`x402tool` is like `curl` for x402 APIs. Hit any [x402-protected](https://www.x402.org/) endpoint — the CLI detects 402 responses, handles Solana payment, and retries with proof automatically.

## Critical Rule: Always Dry-Run First

**NEVER skip dry-run.** It shows what the endpoint costs before any money is spent.

```bash
# Step 1: ALWAYS check the cost first
x402tool GET https://api.example.com/data --dry-run

# Step 2: Only then make the real request
x402tool GET https://api.example.com/data --keypair auth.json
```

If the endpoint does not return 402, dry-run returns the response directly (the API is free).

## Installation

```bash
npm install -g x402tool
```

Requires Node.js v18+. Verify with `x402tool --help`.

## Syntax

```
x402tool <METHOD> <url> [options]
```

`METHOD` is `GET` or `POST`. The URL must be `http` or `https`.

## Flag Reference

| Flag | Purpose | Notes |
| ---- | ------- | ----- |
| `--keypair <path>` | Solana keypair for payment | Required unless `--dry-run`. Must be under cwd or `$HOME`. |
| `--dry-run` | Preview cost without paying | Always use this first. |
| `--body <json>` | JSON request body | POST only. Must be valid JSON string. |
| `--query <k=v>` | Query parameter | Repeatable: `--query foo=1 --query bar=2` |
| `--json` | Machine-readable JSON output | Outputs 402 info and errors as JSON. |
| `--quiet` | Suppress extra logs | Hides wallet address and timing. |
| `--timeout <ms>` | Request timeout | Default 30000ms. |
| `-o, --output <path>` | Write response to file | Path must be under cwd. |
| `--rpc-url <url>` | Solana RPC endpoint | Falls back to `SOLANA_RPC_URL` env var. |

## Keypair

Standard Solana keypair file — a JSON array of bytes. Generate one:

```bash
solana-keygen new -o auth.json
```

Path must resolve under cwd or `$HOME`. Tilde expansion (`~`) works. Never commit keypair files.

## Common Patterns

### GET request

```bash
x402tool GET https://api.example.com/data --keypair auth.json
```

### GET with query parameters

```bash
x402tool GET "https://api.example.com/order" \
  --keypair auth.json \
  --query inputMint=So11111111111111111111111111111111111111112 \
  --query outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --query amount=20000000
```

### POST with JSON body

```bash
x402tool POST https://api.example.com/rpc \
  --keypair auth.json \
  --body '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["ADDRESS"]}'
```

### Save response to file

```bash
x402tool GET https://api.example.com/data --keypair auth.json -o result.json
```

### Quiet mode for scripts

```bash
x402tool GET https://api.example.com/data --keypair auth.json --quiet -o result.json
```

## Dry-Run Output

When `--dry-run` hits a 402, it displays the payment requirements. The human-readable output includes network, asset, amount, pay-to address, scheme, and timeout. Example structure:

```
Payment Requirements (x402 v2)

  Network:     solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
  Asset:       USDC
  Pay To:      <recipient_address>
  Amount:      $0.001 USD
  Scheme:      exact
  Timeout:     60s
```

With `--dry-run --json`, the raw JSON is returned instead:

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "solana:...",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "payTo": "<address>",
    "maxAmountRequired": "1000",
    "maxTimeoutSeconds": 60
  }]
}
```

Common token mints:

| Mint | Token | Decimals |
| ---- | ----- | -------- |
| `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | USDC | 6 |
| `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | USDT | 6 |
| `So11111111111111111111111111111111111111112` | SOL | 9 |

## How It Works

1. CLI sends the request (GET or POST).
2. If the API returns **402**, the CLI parses payment requirements from the response.
3. It signs a Solana transaction using the keypair.
4. It retries the original request with proof in the `PAYMENT-SIGNATURE` header.
5. The API validates payment and returns data.

With `--dry-run`, it stops at step 2.

The network (mainnet/devnet) is determined by the API's 402 response, not by a CLI flag.

## Error Reference

Errors exit with code 1. With `--json`, errors are `{"error": "message"}`.

| Error | Fix |
| ----- | --- |
| `--keypair is required when not using --dry-run` | Add `--keypair path` or use `--dry-run` |
| `--body must be valid JSON` | Check JSON syntax and shell quoting |
| `Keypair path must be a .json file` | Use a `.json` file |
| `Keypair path must be under current directory or home` | Move keypair under cwd or `$HOME` |
| `Invalid URL` | Use `http://` or `https://` scheme |
| `Request failed after payment` | Check body/params — payment was already submitted |
| `Failed to parse payment requirements` | API may not be x402-compliant |
| `Invalid output path` | `-o` path must be under cwd |

## Known x402 Endpoints

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `https://jupiter.api.corbits.dev/tokens/v2/recent` | GET | Recent Jupiter tokens |
| `https://jupiter.api.corbits.dev/ultra/v1/order` | GET | Jupiter swap order (needs query params) |
| `https://triton.api.corbits.dev` | POST | Triton Solana RPC (JSON-RPC body) |
| `https://helius.api.corbits.dev` | POST | Helius Solana RPC (JSON-RPC body) |
| `https://dflow.api.corbits.dev/quote` | GET | DFlow swap quote (needs query params) |
| `https://agent.metengine.xyz/api/v1/markets/trending` | GET | Trending prediction markets |

## Agent Checklist

- [ ] Dry-run first to check cost
- [ ] Ensure keypair file exists and wallet has sufficient balance
- [ ] Use `-o file.json` to capture responses for further processing
- [ ] Never commit or log keypair files
