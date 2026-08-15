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
  initializeGit,
  inspectGit,
  restoreGit,
  stageGit,
  syncGit,
  unstageGit,
} from "../packages/laobos-system-tools/lib/git-service.mjs";

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
