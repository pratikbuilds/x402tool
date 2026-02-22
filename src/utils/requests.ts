import * as fs from "fs/promises";
import * as path from "path";
import axios, { AxiosError } from "axios";
import { getErrorMessage } from "./error.js";
import { x402Client } from "@x402/core/client";
import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import { parsePaymentRequired } from "@x402/core/schemas";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { ExactSvmSchemeV1 } from "@x402/svm/exact/v1/client";
import { NETWORKS } from "@x402/svm/v1";
import { displayPaymentRequirements } from "./display.js";
import type { ClientSvmSigner } from "@x402/svm";
import type { PaymentRequired as PaymentRequiredSchema } from "@x402/core/schemas";

const DEFAULT_HEADERS = {
  Accept: "application/json",
};

function resolveSafeOutputPath(outputPath: string): string {
  const resolved = path.resolve(process.cwd(), outputPath);
  const cwd = path.resolve(process.cwd());
  const cwdWithSep = cwd.endsWith(path.sep) ? cwd : cwd + path.sep;
  if (resolved !== cwd && !resolved.startsWith(cwdWithSep)) {
    throw new Error(
      `Invalid output path: "${outputPath}" resolves outside current working directory. Output must be under ${cwd}`
    );
  }
  return resolved;
}

async function writeOutput(
  content: string,
  outputPath?: string
): Promise<void> {
  if (outputPath) {
    const safePath = resolveSafeOutputPath(outputPath);
    await fs.writeFile(safePath, content, "utf-8");
  } else {
    console.log(content);
  }
}

export async function makeDryRunRequest(
  url: string,
  options?: {
    method?: "GET" | "POST";
    data?: unknown;
    timeout?: number;
    outputPath?: string;
    json?: boolean;
    quiet?: boolean;
  }
): Promise<void> {
  const startTime = performance.now();

  try {
    const method = options?.method || "GET";
    const headers = {
      ...DEFAULT_HEADERS,
      ...(method === "POST" && options?.data
        ? { "Content-Type": "application/json" }
        : {}),
    };
    const axiosConfig = {
      headers,
      timeout: options?.timeout ?? 30_000,
    };
    const response =
      method === "GET"
        ? await axios.get(url, axiosConfig)
        : await axios.post(url, options?.data, axiosConfig);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const output =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data, null, 2);
    await writeOutput(output, options?.outputPath);
    if (!options?.outputPath && !options?.quiet) {
      console.log(`\n⏱️  Request completed in ${duration}ms`);
    }
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 402) {
        const result = parsePaymentRequired(error.response.data);
        if (!result.success) {
          throw new Error(
            `Invalid payment requirements: ${JSON.stringify(result.error.issues, null, 2)}`
          );
        }
        const payReqOutput = JSON.stringify(result.data, null, 2);
        if (options?.outputPath) {
          await writeOutput(payReqOutput, options.outputPath);
        } else if (options?.json) {
          console.log(payReqOutput);
        } else {
          const duration = Math.round(performance.now() - startTime);
          displayPaymentRequirements(result.data);
          if (!options?.quiet) {
            console.log(`\n⏱️  Request completed in ${duration}ms`);
          }
        }
      } else {
        const msg =
          typeof error.response?.data === "object"
            ? JSON.stringify(error.response.data)
            : String(error.response?.data ?? error.message);
        throw new Error(msg);
      }
    } else {
      throw error;
    }
  }
}

function createPaymentClient(
  signer: ClientSvmSigner,
  rpcUrl?: string
): x402Client {
  const client = new x402Client();
  const config = rpcUrl ? { rpcUrl } : undefined;
  client.register("solana:*", new ExactSvmScheme(signer, config));
  for (const net of NETWORKS) {
    client.registerV1(net, new ExactSvmSchemeV1(signer, config));
  }
  return client;
}

function parse402Response(
  getHeader: (name: string) => string | null,
  body: unknown
): PaymentRequiredSchema {
  const header =
    getHeader("PAYMENT-REQUIRED") || getHeader("X-Payment-Required");
  if (header) {
    try {
      const decoded = decodePaymentRequiredHeader(header);
      const result = parsePaymentRequired(decoded);
      if (result.success) return result.data;
    } catch {
      // Fall through to body
    }
  }
  if (body && typeof body === "object" && "x402Version" in body) {
    const result = parsePaymentRequired(body);
    if (result.success) return result.data;
  }
  throw new Error("Invalid payment requirements received");
}

function wrapFetchWithPayment(
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  client: x402Client
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const request = new Request(input, init);
    const clonedRequest = request.clone();
    const response = await fetchFn(request);
    if (response.status !== 402) return response;

    let paymentRequired: PaymentRequiredSchema;
    try {
      const responseText = await response.text();
      let body: unknown;
      try {
        body = responseText ? JSON.parse(responseText) : undefined;
      } catch {
        body = undefined;
      }
      const getHeader = (name: string) => response.headers.get(name);
      paymentRequired = parse402Response(getHeader, body);
    } catch (error) {
      throw new Error(
        `Failed to parse payment requirements: ${getErrorMessage(error)}`
      );
    }

    let paymentPayload;
    try {
      paymentPayload = await client.createPaymentPayload(
        paymentRequired as Parameters<x402Client["createPaymentPayload"]>[0]
      );
    } catch (error) {
      throw new Error(
        `Failed to create payment payload: ${getErrorMessage(error)}`
      );
    }

    const paymentHeaders =
      paymentPayload.x402Version === 2
        ? { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(paymentPayload) }
        : { "X-PAYMENT": encodePaymentSignatureHeader(paymentPayload) };

    for (const [key, value] of Object.entries(paymentHeaders)) {
      clonedRequest.headers.set(key, value);
    }
    clonedRequest.headers.set(
      "Access-Control-Expose-Headers",
      "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE"
    );

    return fetchFn(clonedRequest);
  };
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs?: number
): Promise<Response> {
  if (!timeoutMs) return fetch(input, init);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

export async function makePaymentRequest(
  url: string,
  signer: ClientSvmSigner,
  options?: {
    method?: "GET" | "POST";
    body?: BodyInit | null | undefined;
    rpcUrl?: string;
    timeout?: number;
    outputPath?: string;
  }
): Promise<void> {
  const rpcUrl = options?.rpcUrl || process.env.SOLANA_RPC_URL;
  const client = createPaymentClient(signer, rpcUrl);
  const baseFetch = (input: RequestInfo | URL, init?: RequestInit) =>
    fetchWithTimeout(input, init, options?.timeout ?? 30_000);
  const fetchWithPayer = wrapFetchWithPayment(baseFetch, client);

  try {
    const headers = {
      ...DEFAULT_HEADERS,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    };

    const response = await fetchWithPayer(url, {
      method: options?.method || "GET",
      headers,
      body: options?.body,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const output =
      contentType.includes("application/json") && text
        ? JSON.stringify(JSON.parse(text), null, 2)
        : text;
    await writeOutput(output, options?.outputPath);
  } catch (error) {
    throw new Error(`Failed to make request: ${getErrorMessage(error)}`);
  }
}
