#!/usr/bin/env node

import { Command } from "commander";
import {
  buildUrlWithQueryParams,
  parseQueryOption,
  validateUrlScheme,
} from "./src/utils/url.js";
import { loadSvmSigner } from "./src/utils/keypair.js";
import { makeDryRunRequest, makePaymentRequest } from "./src/utils/requests.js";
import { getErrorMessage } from "./src/utils/error.js";

const program = new Command();

type RequestOptions = {
  keypair?: string;
  dryRun?: boolean;
  rpcUrl?: string;
  query?: Record<string, string>;
  body?: string;
  timeout?: number;
  output?: string;
  json?: boolean;
  quiet?: boolean;
};

async function handleRequest(
  url: string,
  options: RequestOptions,
  method: "GET" | "POST"
): Promise<void> {
  validateUrlScheme(url);
  const finalUrl = buildUrlWithQueryParams(url, options.query);

  let bodyData: unknown;
  if (method === "POST" && options.body) {
    try {
      bodyData = JSON.parse(options.body);
    } catch {
      throw new Error("--body must be valid JSON");
    }
  }

  if (options.dryRun) {
    await makeDryRunRequest(finalUrl, {
      method,
      data: method === "POST" ? bodyData : undefined,
      timeout: options.timeout,
      outputPath: options.output,
      json: options.json,
      quiet: options.quiet,
    });
    return;
  }

  if (!options.keypair) {
    throw new Error("--keypair is required when not using --dry-run");
  }

  const signer = await loadSvmSigner(options.keypair);
  if (!options.quiet) {
    console.log("Wallet:", signer.address);
  }

  const rpcUrl = options.rpcUrl || process.env.SOLANA_RPC_URL;
  await makePaymentRequest(finalUrl, signer, {
    method,
    body: method === "POST" && bodyData ? JSON.stringify(bodyData) : undefined,
    rpcUrl,
    timeout: options.timeout,
    outputPath: options.output,
  });
}

function createRequestCommand(method: "GET" | "POST") {
  const cmd =
    method === "GET"
      ? program.command("GET").description("Send a GET request to an x402-protected API")
      : program.command("POST").description("Send a POST request to an x402-protected API");

  return cmd
    .argument("<url>", "URL to send the request to")
    .option("--keypair <path>", "Path to Solana keypair file (required for payment)")
    .option("--dry-run", "Preview payment requirements without making payment")
    .option("--json", "Machine-readable JSON output (402, errors)")
    .option("--quiet", "Suppress Wallet and timing output")
    .option(
      "--rpc-url <url>",
      "Solana RPC URL (or SOLANA_RPC_URL env var). Recommended for mainnet."
    )
    .option(
      "--query <key=value>",
      "Query parameter (can be used multiple times)",
      parseQueryOption
    )
    .option("--timeout <ms>", "Request timeout in milliseconds", (v) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    })
    .option("-o, --output <path>", "Write response to file instead of stdout");
}

const getExamples = `
Examples:
  x402tool GET https://api.example.com/data --dry-run
  x402tool GET https://api.example.com/data --keypair ~/.config/solana/auth.json
  x402tool GET https://api.example.com/data -o response.json
`;

const postExamples = `
Examples:
  x402tool POST https://api.example.com/action --dry-run --body '{"key":"value"}'
  x402tool POST https://api.example.com/action --keypair ~/.config/solana/auth.json --body '{}'
  x402tool POST https://api.example.com/action -o response.json
`;

createRequestCommand("GET")
  .addHelpText("after", getExamples)
  .action(async (url, options) => {
    try {
      await handleRequest(url, options, "GET");
    } catch (error) {
      if (options.json) {
        console.log(
          JSON.stringify({ error: getErrorMessage(error) })
        );
      } else {
        console.error("Error:", getErrorMessage(error));
      }
      process.exit(1);
    }
  });

createRequestCommand("POST")
  .option("--body <json>", "JSON body for POST request (as JSON string)")
  .addHelpText("after", postExamples)
  .action(async (url, options) => {
    try {
      await handleRequest(url, options, "POST");
    } catch (error) {
      if (options.json) {
        console.log(
          JSON.stringify({ error: getErrorMessage(error) })
        );
      } else {
        console.error("Error:", getErrorMessage(error));
      }
      process.exit(1);
    }
  });

program.parse();
