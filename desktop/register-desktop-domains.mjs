import { registerConversationExportIpc } from "./domains/conversation-export.mjs";
import { registerBrowserIpc } from "./domains/browser.mjs";
import { registerAppsIpc } from "./domains/apps.mjs";
import { DesktopSettingsStore } from "./domains/desktop-settings.mjs";
import { registerGitReviewIpc } from "./domains/git-review.mjs";
import { registerSessionTrashIpc } from "./domains/session-trash.mjs";
import { registerSshIpc } from "./domains/ssh.mjs";
import { registerTerminalIpc } from "./domains/terminal.mjs";
import { registerWorkspaceFilesIpc } from "./domains/workspace-files.mjs";
import { assertTrustedDesktopSender } from "./ipc-security.mjs";
import path from "node:path";

export function registerDesktopDomains(options) {
  const authorize = (event) => assertTrustedDesktopSender(event, options);
  const settings = new DesktopSettingsStore(
    path.join(options.app.getPath("userData"), "desktop-settings.json"),
  );
  const disposers = [
    registerAppsIpc({ ...options, authorize }),
    registerBrowserIpc({ ...options, authorize }),
    registerConversationExportIpc({ ...options, authorize }),
    registerSessionTrashIpc({ ...options, authorize }),
    registerWorkspaceFilesIpc({ ...options, authorize, settings }),
    registerGitReviewIpc({ ...options, authorize }),
    registerTerminalIpc({ ...options, authorize }),
    registerSshIpc({ ...options, authorize }),
  ];
  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
