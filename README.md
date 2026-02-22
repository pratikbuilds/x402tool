# x402tool

[![npm version](https://img.shields.io/npm/v/x402tool.svg)](https://www.npmjs.com/package/x402tool)
[![npm downloads](https://img.shields.io/npm/dm/x402tool.svg)](https://www.npmjs.com/package/x402tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line interface for interacting with x402 APIs on Solana. This CLI tool enables you to make GET and POST requests to x402-protected endpoints, automatically handling payment requirements using Solana payments.

## Features

- **Automatic payment handling**: Intercepts 402 Payment Required responses and executes Solana transactions transparently
- **Dry-run mode**: Inspect payment requirements without executing transactions
- **HTTP method support**: GET and POST requests with optional JSON payloads
- **Solana integration**: Uses [@x402/svm](https://www.npmjs.com/package/@x402/svm) for payment execution; network is resolved from API payment requirements
- **Query parameter support**: Multiple query parameters via repeated flags
- **Agent-friendly output**: `--json` for machine-readable output, `--quiet` to suppress extra logs
- **Configurable timeout**: Default 30s, overridable via `--timeout`
- **Output to file**: `-o/--output` writes response to a file (path must be under current directory)
- **RPC URL**: `--rpc-url` or `SOLANA_RPC_URL` env var (recommended for mainnet)
- **Security**: URL validation (http/https only), keypair path restricted to cwd or home, `NO_COLOR` support

## Installation

### Prerequisites

- Node.js v18.0.0 or later
- npm or yarn

### Install from npm

```bash
npm install -g x402tool
```

Or using yarn:

```bash
yarn global add x402tool
```

### Verify Installation

```bash
x402tool --version
```

## Usage

### Basic GET Request

```bash
x402tool GET <url>
```

### Basic POST Request

```bash
x402tool POST <url>
```

POST requests can optionally include a JSON body:

```bash
x402tool POST <url> --body '{"key": "value"}'
```

### Dry Run (Preview Payment Requirements)

Preview payment requirements without making a payment:

```bash
x402tool GET <url> --dry-run
x402tool POST <url> --dry-run
```

### Making Payments

To make a request that requires payment, provide a Solana keypair:

```bash
x402tool GET <url> --keypair <path-to-keypair.json>
x402tool POST <url> --keypair <path-to-keypair.json>
```

### Query Parameters

Add query parameters using the `--query` option (can be used multiple times):

```bash
x402tool GET <url> --query "key1=value1" --query "key2=value2"
```

### RPC URL (Recommended for Mainnet)

Provide a Solana RPC URL for payment execution. Without it, the x402 SDK may use public endpoints:

```bash
x402tool GET <url> --keypair <path> --rpc-url https://api.mainnet-beta.solana.com
# or set SOLANA_RPC_URL env var
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
x402tool GET <url> --keypair <path>
```

### Output to File

Write the response to a file instead of stdout (path must be under current directory):

```bash
x402tool GET <url> -o response.json
x402tool POST <url> --dry-run -o payment-requirements.json
```

### Agent-Friendly Mode

For scripts and AI agents, use `--json` for machine-readable output and `--quiet` to suppress wallet/timing logs:

```bash
x402tool GET <url> --dry-run --json
x402tool POST <url> --keypair <path> --quiet -o result.json
```

### Timeout

Override the default 30-second timeout:

```bash
x402tool GET <url> --timeout 60000
```

## Command Options

### GET Command

- `<url>` (required): The URL to send the GET request to (must be http or https)
- `--keypair <path>`: Path to Solana keypair file (required for payment mode; must be under cwd or home)
- `--dry-run`: Preview payment requirements without making payment
- `--json`: Machine-readable JSON output for 402 responses and errors
- `--quiet`: Suppress wallet address and timing output
- `--rpc-url <url>`: Solana RPC URL (or use `SOLANA_RPC_URL` env var)
- `--query <key=value>`: Query parameter (can be used multiple times)
- `--timeout <ms>`: Request timeout in milliseconds (default: 30000)
- `-o, --output <path>`: Write response to file (must be under current directory)

### POST Command

- `<url>` (required): The URL to send the POST request to (must be http or https)
- `--keypair <path>`: Path to Solana keypair file (required for payment mode; must be under cwd or home)
- `--dry-run`: Preview payment requirements without making payment
- `--json`: Machine-readable JSON output for 402 responses and errors
- `--quiet`: Suppress wallet address and timing output
- `--rpc-url <url>`: Solana RPC URL (or use `SOLANA_RPC_URL` env var)
- `--query <key=value>`: Query parameter (can be used multiple times)
- `--body <json>`: JSON body for POST request (as JSON string, optional)
- `--timeout <ms>`: Request timeout in milliseconds (default: 30000)
- `-o, --output <path>`: Write response to file (must be under current directory)

## Examples

The following examples demonstrate usage with [Corbits](https://docs.corbits.dev) x402-protected APIs, including Jupiter and Triton RPC endpoints.

### Example 1: Jupiter GET Request (Dry Run)

Preview payment requirements for a Jupiter API request with query parameters:

```bash
x402tool GET "https://jupiter.api.corbits.dev/ultra/v1/order" \
  --dry-run \
  --query inputMint=So11111111111111111111111111111111111111112 \
  --query outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --query amount=20000000 \
  --query taker=YOUR_WALLET_ADDRESS
```

### Example 2: Jupiter GET Request (With Payment)

Make a paid request to Jupiter API. Use `--rpc-url` for mainnet:

```bash
x402tool GET https://jupiter.api.corbits.dev/tokens/v2/recent \
  --keypair ~/.config/solana/auth.json \
  --rpc-url https://api.mainnet-beta.solana.com
```

### Example 3: Triton RPC POST Request (Dry Run)

Preview payment requirements for a Triton RPC call. See [Triton RPC documentation](https://docs.corbits.dev/api/partners/triton/overview) for details:

```bash
x402tool POST https://triton.api.corbits.dev \
  --dry-run \
  --body '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["corzHctjX9Wtcrkfxz3Se8zdXqJYCaamWcQA7vwKF7Q"]}'
```

### Example 4: Triton RPC POST Request (With Payment)

Execute a Solana RPC method via Triton with automatic payment:

```bash
x402tool POST https://triton.api.corbits.dev \
  --keypair ~/.config/solana/auth.json \
  --body '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["corzHctjX9Wtcrkfxz3Se8zdXqJYCaamWcQA7vwKF7Q"]}'
```

### Example 5: Agent-Friendly Output

Get machine-readable JSON for scripting or AI agents:

```bash
x402tool GET https://api.example.com/data --dry-run --json
x402tool POST https://api.example.com/action --keypair auth.json --quiet -o result.json
```

## How It Works

1. **Dry Run Mode**: When `--dry-run` is used, the CLI makes a request (GET or POST) and displays payment requirements if a 402 response is received. No payment is made. Use `--json` for machine-readable output.

2. **Payment Mode**: When a keypair is provided:

   - The CLI fetches payment requirements from the API
   - If a 402 Payment Required response is received, it extracts Solana payment options via [@x402/core](https://www.npmjs.com/package/@x402/core)
   - Uses [@x402/svm](https://www.npmjs.com/package/@x402/svm) to create and submit a Solana payment transaction
   - Retries the original request with payment proof

3. **Network**: The network (mainnet/devnet) is determined by the API's payment requirements, not by a CLI flag. Provide `--rpc-url` or `SOLANA_RPC_URL` for reliable mainnet execution.

4. **POST Requests**: POST requests support optional JSON bodies. If no `--body` is provided, the request is sent without a body. This works consistently in both dry-run and payment modes.

5. **Security**: URLs are validated (http/https only). Keypair paths must be under the current directory or home directory. Set `NO_COLOR=1` to disable colored output.

## Keypair Format

The keypair file should be a JSON array of numbers (Solana's standard keypair format). The path must be under your current directory or home directory.

```json
[123,45,67,...]
```

You can generate a keypair using Solana CLI:

```bash
solana-keygen new -o my-keypair.json
```

## Dependencies

This CLI uses the [x402](https://github.com/x402-protocol) protocol stack:

- `@x402/core` – Payment requirement parsing and HTTP headers
- `@x402/svm` – Solana payment execution (ExactSvmScheme, ExactSvmSchemeV1)
- `@solana/kit` – Keypair loading

## Development

### Prerequisites

- Node.js v18.0.0 or later
- npm or yarn
- TypeScript ^5.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/pratikbuilds/x402-cli.git
cd x402-cli

# Install dependencies
npm install

# Build the project
npm run build
```

### Running Locally

After building, you can run the CLI locally:

```bash
node dist/index.js GET <url>
```

Or use npm link for development:

```bash
npm link
x402tool GET <url>
```

## Contributing

Contributions are welcome! This project is open to contributions from the community. Whether it's bug fixes, new features, documentation improvements, or other enhancements, we appreciate your help in making this CLI tool better.

To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feat/your-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
