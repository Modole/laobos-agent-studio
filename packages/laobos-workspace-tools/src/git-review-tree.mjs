function normalizedTreePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/");
}

function sortTree(nodes) {
  nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
  });
  for (const node of nodes) if (node.type === "directory") sortTree(node.children);
  return nodes;
}

/** Build a virtual directory tree from Git change or commit file records. */
export function buildGitReviewTree(files) {
  const root = [];
  const directories = new Map([["", root]]);
  const seen = new Set();
  for (const source of Array.isArray(files) ? files : []) {
    const record = typeof source === "string" ? { path: source } : source;
    const treePath = normalizedTreePath(record?.path);
    if (!treePath || seen.has(treePath)) continue;
    seen.add(treePath);
    const parts = treePath.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let parentPath = "";
    let children = root;
    for (const part of parts.slice(0, -1)) {
      const directoryPath = parentPath ? `${parentPath}/${part}` : part;
      let directoryChildren = directories.get(directoryPath);
      if (directoryChildren === undefined) {
        directoryChildren = [];
        children.push({ type: "directory", name: part, treePath: directoryPath, children: directoryChildren });
        directories.set(directoryPath, directoryChildren);
      }
      parentPath = directoryPath;
      children = directoryChildren;
    }
    children.push({
      ...record,
      type: "file",
      name: parts.at(-1),
      path: record.path,
      treePath,
    });
  }
  return sortTree(root);
}

export function gitReviewDirectoryPaths(tree) {
  const paths = [];
  const visit = (nodes) => {
    for (const node of nodes || []) {
      if (node.type !== "directory") continue;
      paths.push(node.treePath);
      visit(node.children);
    }
  };
  visit(tree);
  return paths;
}
