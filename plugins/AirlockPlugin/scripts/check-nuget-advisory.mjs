import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createOsvAdvisoryProvider } from "../gates/dependency-risk/advisory-client.mjs";
import { dataRoot } from "../runtime/broker.mjs";

export async function checkNugetAdvisory({
  packageName,
  version,
  root = dataRoot,
  fetchImpl,
  now,
  ttlMs,
} = {}) {
  const provider = createOsvAdvisoryProvider({
    root,
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
    ...(now === undefined ? {} : { now }),
    ...(ttlMs === undefined ? {} : { ttlMs }),
  });
  return provider({ packageName, version });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const [, , packageName, version] = process.argv;
  if (!packageName || !version) {
    console.error("Usage: node check-nuget-advisory.mjs <package-name> <exact-version>");
    process.exitCode = 1;
  } else {
    const result = await checkNugetAdvisory({ packageName, version });
    console.log(JSON.stringify({ packageName, version, ...result }, null, 2));
    process.exitCode = result.status !== "checked"
      ? 1
      : result.advisoryIds.length > 0 ? 2 : 0;
  }
}
