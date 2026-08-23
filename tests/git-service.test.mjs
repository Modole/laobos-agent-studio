import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  branchGit,
  commitGit,
  diffGit,
  GitServiceError,
  gitExecutableCandidates,
  initializeGit,
  inspectGit,
  parseGitNumstat,
  resolveGitExecutable,
  restoreGit,
  stageGit,
  summarizeGitChanges,
  syncGit,
  unstageGit,
} from "../packages/laobos-system-tools/lib/git-service.mjs";

test("Git executable discovery covers packaged Windows GUI environments", async () => {
  const env = {
    ProgramFiles: "C:\\Program Files",
    LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local",
    USERPROFILE: "C:\\Users\\tester",
    ChocolateyInstall: "C:\\ProgramData\\chocolatey",
  };
  const candidates = gitExecutableCandidates({
    platform: "win32",
    env,
    resourcesPath: "D:\\Apps\\Laobos\\resources",
  });
  assert.ok(candidates.includes("C:\\Program Files\\Git\\cmd\\git.exe"));
  assert.ok(candidates.includes("C:\\Users\\tester\\AppData\\Local\\Programs\\Git\\cmd\\git.exe"));
  assert.ok(candidates.includes("C:\\Users\\tester\\scoop\\apps\\git\\current\\cmd\\git.exe"));
  assert.ok(candidates.includes("C:\\ProgramData\\chocolatey\\bin\\git.exe"));
  assert.ok(candidates.includes("D:\\Apps\\Laobos\\resources\\git\\cmd\\git.exe"));

  const checked = [];
  const executable = await resolveGitExecutable({
    platform: "win32",
    env,
    resourcesPath: "D:\\Apps\\Laobos\\resources",
    canAccess: async (candidate) => {
      checked.push(candidate);
      if (candidate !== "C:\\Users\\tester\\AppData\\Local\\Programs\\Git\\cmd\\git.exe") {
        throw new Error("missing");
      }
    },
  });
  assert.equal(executable, "C:\\Users\\tester\\AppData\\Local\\Programs\\Git\\cmd\\git.exe");
  assert.ok(checked.length > 1);
});

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-git-service-"));
  await initializeGit(root, { branch: "main" });
  git(root, "config", "user.name", "劳博士测试");
  git(root, "config", "user.email", "git-test@localhost");
  return root;
}

test("Git service supports empty repositories, untracked diffs and optimistic local commits", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-git-empty-"));
  try {
    assert.equal((await inspectGit(root)).isRepository, false);
    let state = await initializeGit(root, { branch: "main" });
    assert.equal(state.isRepository, true);
    assert.equal(state.head, null);
    assert.deepEqual(state.commits, []);
    git(root, "config", "user.name", "");
    git(root, "config", "user.email", "");

    await writeFile(path.join(root, "hello world.txt"), "hello\n");
    state = await inspectGit(root);
    const untracked = state.changes.find((change) => change.path === "hello world.txt");
    assert.equal(untracked?.untracked, true);
    const preview = await diffGit(root, { side: "untracked", path: untracked.path });
    assert.match(preview.diff, /\+hello/u);

    await assert.rejects(
      () => stageGit(root, { paths: [untracked.path], expectedStatusToken: "stale" }),
      (error) => error instanceof GitServiceError && error.code === "STATUS_CHANGED",
    );
    state = await stageGit(root, { paths: [untracked.path], expectedStatusToken: state.statusToken });
    assert.equal(state.changes[0].staged, true);
    state = await unstageGit(root, { paths: [untracked.path], expectedStatusToken: state.statusToken });
    assert.equal(state.changes[0].untracked, true);
    state = await stageGit(root, { paths: [untracked.path], expectedStatusToken: state.statusToken });
    state = await commitGit(root, {
      message: "feat: first version",
      expectedHead: state.head,
      expectedStatusToken: state.statusToken,
    });
    assert.ok(state.head);
    assert.equal(state.commits[0].subject, "feat: first version");
    assert.equal(git(root, "log", "-1", "--pretty=%an <%ae>").trim(), "劳博士 Agent <laobos-agent@local>");
    assert.deepEqual(state.changes, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git service keeps staged and unstaged sides distinct and restores only tracked worktree changes", async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, "mixed.txt"), "base\n");
    let state = await inspectGit(root);
    state = await stageGit(root, { paths: ["mixed.txt"], expectedStatusToken: state.statusToken });
    state = await commitGit(root, { message: "base", expectedHead: state.head, expectedStatusToken: state.statusToken });

    await writeFile(path.join(root, "mixed.txt"), "staged\n");
    state = await inspectGit(root);
    state = await stageGit(root, { paths: ["mixed.txt"], expectedStatusToken: state.statusToken });
    await writeFile(path.join(root, "mixed.txt"), "unstaged\n");
    state = await inspectGit(root);
    const mixed = state.changes.find((change) => change.path === "mixed.txt");
    assert.equal(mixed.staged, true);
    assert.equal(mixed.unstaged, true);
    assert.match((await diffGit(root, { side: "staged", path: "mixed.txt" })).diff, /\+staged/u);
    assert.match((await diffGit(root, { side: "unstaged", path: "mixed.txt" })).diff, /\+unstaged/u);
    const mixedSummary = await summarizeGitChanges(root, { paths: ["mixed.txt"] });
    assert.equal(mixedSummary.files[0].side, "unstaged");
    assert.equal(mixedSummary.additions, 1);
    assert.equal(mixedSummary.deletions, 1);
    assert.equal(mixedSummary.stale, false);

    state = await restoreGit(root, { paths: ["mixed.txt"], expectedStatusToken: state.statusToken });
    assert.equal(state.changes.find((change) => change.path === "mixed.txt")?.unstaged, false);
    await writeFile(path.join(root, "untracked.txt"), "do not delete\n");
    state = await inspectGit(root);
    await assert.rejects(
      () => restoreGit(root, { paths: ["untracked.txt"], expectedStatusToken: state.statusToken }),
      (error) => error instanceof GitServiceError && error.code === "RESTORE_UNSAFE",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git commit diffs enumerate every changed file for the review tree", async () => {
  const root = await fixture();
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "app.js"), "console.log('app');\n");
    await writeFile(path.join(root, "README.md"), "review tree\n");
    let state = await inspectGit(root);
    state = await stageGit(root, { paths: ["src/app.js", "README.md"], expectedStatusToken: state.statusToken });
    state = await commitGit(root, { message: "add review files", expectedHead: state.head, expectedStatusToken: state.statusToken });

    const result = await diffGit(root, { side: "commit", ref: state.head });
    assert.deepEqual(result.files.map((file) => [file.path, file.status]).sort(), [["README.md", "A"], ["src/app.js", "A"]]);
    const single = await diffGit(root, { side: "commit", ref: state.head, path: "src/app.js" });
    assert.equal("files" in single, false);
    assert.match(single.diff, /src\/app\.js/u);
    assert.doesNotMatch(single.diff, /README\.md/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git service summarizes only the requested current changes", async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, "tracked.txt"), "one\ntwo\n");
    let state = await inspectGit(root);
    state = await stageGit(root, { paths: ["tracked.txt"], expectedStatusToken: state.statusToken });
    await commitGit(root, { message: "base", expectedHead: state.head, expectedStatusToken: state.statusToken });

    await writeFile(path.join(root, "tracked.txt"), "one changed\nthree\n");
    await writeFile(path.join(root, "new.txt"), "new\nline\n");
    await writeFile(path.join(root, "unrelated.txt"), "ignore me\n");

    const summary = await summarizeGitChanges(root, { paths: ["tracked.txt", "new.txt"] });
    assert.equal(summary.isRepository, true);
    assert.deepEqual(summary.files.map((file) => file.path), ["tracked.txt", "new.txt"]);
    assert.equal(summary.files[0].side, "unstaged");
    assert.equal(summary.files[1].side, "untracked");
    assert.equal(summary.additions, 4);
    assert.equal(summary.deletions, 2);
    assert.equal(summary.files.some((file) => file.path === "unrelated.txt"), false);

    await assert.rejects(
      () => summarizeGitChanges(root, { paths: ["../outside.txt"] }),
      (error) => error instanceof GitServiceError && error.code === "PATH_INVALID",
    );
    await assert.rejects(
      () => summarizeGitChanges(root, { paths: Array.from({ length: 201 }, (_, index) => `file-${index}.txt`) }),
      (error) => error instanceof GitServiceError && error.code === "PATHS_INVALID",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git numstat parser preserves text totals and marks binary entries", () => {
  assert.deepEqual(parseGitNumstat("3\t2\ttext.txt\0-\t-\timage.png\0"), {
    additions: 3,
    deletions: 2,
    binary: true,
    statsAvailable: true,
  });
});

test("Git service parses renames, manages branches and pushes without force refspecs", async () => {
  const root = await fixture();
  const remote = await mkdtemp(path.join(os.tmpdir(), "laobos-git-remote-"));
  try {
    git(remote, "init", "--bare");
    await writeFile(path.join(root, "before.txt"), "content\n");
    let state = await inspectGit(root);
    state = await stageGit(root, { paths: ["before.txt"], expectedStatusToken: state.statusToken });
    state = await commitGit(root, { message: "base", expectedHead: state.head, expectedStatusToken: state.statusToken });
    git(root, "mv", "before.txt", "after.txt");
    state = await inspectGit(root);
    const renamed = state.changes.find((change) => change.path === "after.txt");
    assert.equal(renamed.kind, "renamed");
    assert.equal(renamed.originalPath, "before.txt");
    const renamedSummary = await summarizeGitChanges(root, { paths: ["before.txt"] });
    assert.equal(renamedSummary.files[0].path, "after.txt");
    assert.equal(renamedSummary.files[0].originalPath, "before.txt");

    state = await branchGit(root, { action: "create", name: "dsh/test", expectedHead: state.head });
    assert.equal(state.branch, "dsh/test");
    state = await branchGit(root, { action: "switch", name: "main", expectedHead: state.head });
    assert.equal(state.branch, "main");
    state = await branchGit(root, { action: "delete", name: "dsh/test", expectedHead: state.head });
    assert.equal(state.branches.some((branch) => branch.name === "dsh/test"), false);

    git(root, "remote", "add", "origin", remote);
    state = await inspectGit(root);
    state = await syncGit(root, { action: "push", remote: "origin", expectedHead: state.head });
    assert.equal(state.upstream, "origin/main");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(remote, { recursive: true, force: true });
  }
});

test("Git service refuses to discover a repository above the selected workspace boundary", async () => {
  const root = await fixture();
  const child = path.join(root, "project");
  await mkdir(child);
  try {
    await assert.rejects(
      () => inspectGit(child),
      (error) => error instanceof GitServiceError && error.code === "REPOSITORY_OUTSIDE_ROOT",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
