import type { PaymentRequired } from "@x402/core/schemas";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

const noColor = !!(
  process.env.NO_COLOR !== undefined &&
  process.env.NO_COLOR !== ""
);

function colorize(text: string, color: keyof typeof colors): string {
  return noColor ? text : `${colors[color]}${text}${colors.reset}`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return JSON.stringify(value);
}

function getAmount(accept: PaymentRequired["accepts"][number]): string {
  return "maxAmountRequired" in accept ? accept.maxAmountRequired : accept.amount;
}

/** Solana mint addresses to display symbol */
const MINT_TO_SYMBOL: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  So11111111111111111111111111111111111111112: "SOL",
};

function getAssetSymbol(asset: string): string {
  return MINT_TO_SYMBOL[asset] ?? asset.split(":").pop() ?? asset;
}

function getDecimalsForAsset(asset: string): number {
  const symbol = getAssetSymbol(asset).toUpperCase();
  if (symbol === "USDC" || symbol === "USDT") return 6;
  if (symbol === "SOL") return 9;
  return 6; // default for unknown stablecoins
}

function isStablecoin(asset: string): boolean {
  const symbol = getAssetSymbol(asset).toUpperCase();
  return symbol === "USDC" || symbol === "USDT";
}

function formatAmountInUsd(rawAmount: string, asset: string): string {
  const decimals = getDecimalsForAsset(asset);
  const value = Number(rawAmount) / 10 ** decimals;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });

  if (isStablecoin(asset)) {
    return `$${formatted} USD`;
  }
  return `${formatted} ${getAssetSymbol(asset)}`;
}

function getResourceUrl(
  payResp: PaymentRequired,
  accept: PaymentRequired["accepts"][number]
): string {
  if ("resource" in accept && typeof accept.resource === "string") {
    return accept.resource;
  }
  if ("resource" in payResp && payResp.resource && typeof payResp.resource === "object" && "url" in payResp.resource) {
    return payResp.resource.url;
  }
  return "—";
}

function getDescription(
  payResp: PaymentRequired,
  accept: PaymentRequired["accepts"][number]
): string {
  if ("description" in accept && typeof accept.description === "string") {
    return accept.description;
  }
  if ("resource" in payResp && payResp.resource && typeof payResp.resource === "object" && "description" in payResp.resource && payResp.resource.description) {
    return payResp.resource.description;
  }
  return "—";
}

export function displayPaymentRequirements(payResp: PaymentRequired) {
  if ("error" in payResp || !("x402Version" in payResp)) {
    console.error("Invalid payment response:", payResp);
    return;
  }

  console.log("\n");
  console.log(
    colorize(
      `═══════════════════════════════════════════════════════════════════`,
      "cyan"
    )
  );
  console.log(
    colorize(
      `  Payment Requirements ${colorize(
        `(x402 v${payResp.x402Version})`,
        "dim"
      )}`,
      "bright"
    )
  );
  console.log(
    colorize(
      `═══════════════════════════════════════════════════════════════════`,
      "cyan"
    )
  );
  console.log("");

  payResp.accepts.forEach((accept, index) => {
    console.log(
      colorize(`Payment Option ${index + 1}`, "yellow") +
        colorize(` (${accept.network})`, "dim")
    );
    console.log("");

    console.log(`  ${colorize("Network:", "cyan")}        ${accept.network}`);
    console.log(
      `  ${colorize("Asset:", "cyan")}          ${colorize(getAssetSymbol(accept.asset), "green")}`
    );
    console.log(
      `  ${colorize("Pay To:", "cyan")}         ${colorize(accept.payTo, "green")}`
    );
    const rawAmount = getAmount(accept);
    const amountUsd = formatAmountInUsd(rawAmount, accept.asset);
    console.log(
      `  ${colorize("Amount:", "cyan")}         ${colorize(amountUsd, "yellow")}`
    );
    console.log(`  ${colorize("Scheme:", "cyan")}         ${accept.scheme}`);
    console.log(
      `  ${colorize("Description:", "cyan")}    ${getDescription(payResp, accept)}`
    );
    console.log(
      `  ${colorize("Resource:", "cyan")}      ${colorize(getResourceUrl(payResp, accept), "blue")}`
    );
    console.log(
      `  ${colorize("Timeout:", "cyan")}       ${accept.maxTimeoutSeconds}s`
    );

    if (accept.extra && Object.keys(accept.extra).length > 0) {
      console.log("");
      console.log(`  ${colorize("Extra Info:", "magenta")}`);
      Object.entries(accept.extra).forEach(([key, value]) => {
        const displayValue = formatValue(value);
        console.log(
          `    ${colorize(key + ":", "dim")} ${colorize(displayValue, "gray")}`
        );
      });
    }

    if (index < payResp.accepts.length - 1) {
      console.log("");
      console.log(colorize("─".repeat(60), "dim"));
      console.log("");
    }
  });

  console.log("");
}
