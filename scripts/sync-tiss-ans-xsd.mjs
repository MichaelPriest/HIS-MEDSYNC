import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "vendor", "tiss", "040300");
const manifestPath = join(vendorDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(vendorDir, { recursive: true });

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function getVerifiedFile(fileName, expectedHash) {
  const localPath = join(vendorDir, fileName);
  try {
    const local = await readFile(localPath);
    if (sha256(local) === expectedHash) return { source: "local", bytes: local };
  } catch {
    // Materializa abaixo quando o arquivo ainda não existe no checkout.
  }

  const url = `${manifest.verifiedMirror.baseRawUrl}/${encodeURIComponent(fileName)}`;
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "HIS-MEDSYNC-TISS-XSD-Sync/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Falha ao obter ${fileName}: HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(bytes);
  if (actualHash !== expectedHash) {
    throw new Error(`SHA-256 divergente em ${fileName}: esperado ${expectedHash}, recebido ${actualHash}`);
  }
  await writeFile(localPath, bytes);
  return { source: "verified-mirror", bytes };
}

const results = [];
for (const [fileName, expectedHash] of Object.entries(manifest.files)) {
  const result = await getVerifiedFile(fileName, expectedHash);
  results.push(`${fileName}:${result.source}`);
}

console.log(`TISS_XSD_SYNC_OK version=${manifest.communicationVersion} files=${results.length} ${results.join(" ")}`);
