import { createKeyPairSignerFromBytes } from "@solana/kit";
import { toClientSvmSigner } from "@x402/svm";
import * as fs from "fs/promises";
import { getErrorMessage } from "./error.js";
import * as os from "os";
import * as path from "path";

function resolveAndValidateKeypairPath(keypairPath: string): string {
  if (!keypairPath) {
    throw new Error("Keypair path is required");
  }
  if (!keypairPath.toLowerCase().endsWith(".json")) {
    throw new Error(
      `Keypair path must be a .json file: ${keypairPath}`
    );
  }
  const expanded =
    keypairPath.startsWith("~") || keypairPath.startsWith("~/")
      ? path.join(os.homedir(), keypairPath.slice(1).replace(/^\//, ""))
      : keypairPath;
  const resolved = path.resolve(expanded);
  const cwd = path.resolve(process.cwd());
  const home = os.homedir();
  const isUnderCwd =
    resolved === cwd || resolved.startsWith(cwd + path.sep);
  const isUnderHome =
    resolved === home || resolved.startsWith(home + path.sep);
  if (!isUnderCwd && !isUnderHome) {
    throw new Error(
      `Keypair path must be under current directory or home: ${keypairPath}`
    );
  }
  return resolved;
}

export async function loadSvmSigner(keypairPath: string) {
  const resolvedPath = resolveAndValidateKeypairPath(keypairPath);

  try {
    const contents = await fs.readFile(resolvedPath, "utf-8");
    const keypairBytes = new Uint8Array(JSON.parse(contents));
    const kitKeypair = await createKeyPairSignerFromBytes(keypairBytes);
    return toClientSvmSigner(kitKeypair);
  } catch (error) {
    throw new Error(`Failed to load keypair: ${getErrorMessage(error)}`);
  }
}
