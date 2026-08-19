import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default async function signTestUpdate(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const requirements = path.join(
    context.packager.projectDir,
    "build",
    "test-update-requirements.rqset",
  );

  // electron-builder first signs every nested component in dependency order.
  // Re-sign only the outer bundle so its designated requirement is stable
  // across adjacent ad-hoc test versions without invalidating nested code.
  await execFileAsync("codesign", [
    "--force",
    "--sign",
    "-",
    "--requirements",
    requirements,
    appPath,
  ]);
  await execFileAsync("codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=4",
    appPath,
  ]);
}
