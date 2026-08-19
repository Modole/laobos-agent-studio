import { registerConversationExportIpc } from "./domains/conversation-export.mjs";
import { registerBrowserIpc } from "./domains/browser.mjs";
import { registerClipboardIpc } from "./domains/clipboard.mjs";
import { registerAppsIpc } from "./domains/apps.mjs";
import { DesktopSettingsStore } from "./domains/desktop-settings.mjs";
import { registerGitReviewIpc } from "./domains/git-review.mjs";
import { registerSessionTrashIpc } from "./domains/session-trash.mjs";
import { registerShellIpc } from "./domains/shell.mjs";
import { registerSshIpc } from "./domains/ssh.mjs";
import { registerTerminalIpc } from "./domains/terminal.mjs";
import { registerUpdaterIpc } from "./domains/updater.mjs";
import { registerWorkspaceFilesIpc } from "./domains/workspace-files.mjs";
import { assertTrustedDesktopSender } from "./ipc-security.mjs";
import { WorkspaceAuthorization } from "./workspace-authorization.mjs";
import path from "node:path";

export function registerDesktopDomains(options) {
  const authorize = (event) => assertTrustedDesktopSender(event, options);
  const settings = new DesktopSettingsStore(
    path.join(options.app.getPath("userData"), "desktop-settings.json"),
  );
  const workspaceAuthorizer = new WorkspaceAuthorization({
    defaultRoot: options.workspace,
    settings,
    dialog: options.dialog,
    getMainWindow: options.getMainWindow,
  });
  const domainOptions = { ...options, authorize, settings, workspaceAuthorizer };
  const disposers = [
    registerClipboardIpc(domainOptions),
    registerAppsIpc(domainOptions),
    registerBrowserIpc(domainOptions),
    registerConversationExportIpc(domainOptions),
    registerSessionTrashIpc(domainOptions),
    registerWorkspaceFilesIpc(domainOptions),
    registerGitReviewIpc(domainOptions),
    registerShellIpc(domainOptions),
    registerTerminalIpc(domainOptions),
    registerSshIpc(domainOptions),
    registerUpdaterIpc(domainOptions),
  ];
  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
