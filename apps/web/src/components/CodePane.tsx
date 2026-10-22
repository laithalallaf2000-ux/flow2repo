import { useMemo, useState } from "react";
import type { GenerationResult, OutputFile } from "@flow2repo/converter";
import { formatBytes } from "../lib/files";
import { highlight } from "../lib/highlight";
import { CheckIcon, CopyIcon, FileIcon, FolderIcon } from "./Icons";

interface TreeNode {
  name: string;
  path: string;
  file?: OutputFile;
  children: TreeNode[];
}

function buildTree(files: OutputFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/");
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path, children: [] };
        node.children.push(child);
      }
      if (i === parts.length - 1) child.file = file;
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}

interface CodePaneProps {
  result: GenerationResult;
  selected: string;
  onSelect: (path: string) => void;
}

export default function CodePane({ result, selected, onSelect }: CodePaneProps) {
  const tree = useMemo(() => buildTree(result.files), [result]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["public"]));
  const [copied, setCopied] = useState(false);
  const file = result.files.find((f) => f.path === selected) ?? result.files[0];
  const text = typeof file?.data === "string" ? file.data : null;
  const html = useMemo(() => (text !== null && file ? highlight(text, file.path) : ""), [text, file]);
  const lineCount = text ? text.split("\n").length - (text.endsWith("\n") ? 1 : 0) : 0;

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) =>
      node.file ? (
        <button
          key={node.path}
          type="button"
          className={`tree__item${node.path === file?.path ? " tree__item--on" : ""}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => onSelect(node.path)}
        >
          <FileIcon width={14} height={14} /> {node.name}
        </button>
      ) : (
        <div key={node.path}>
          <button
            type="button"
            className="tree__item tree__folder"
            style={{ paddingLeft: 12 + depth * 14 }}
            onClick={() => toggle(node.path)}
          >
            <FolderIcon width={14} height={14} /> {node.name}
            <span className="tree__chevron">{collapsed.has(node.path) ? "▸" : "▾"}</span>
          </button>
          {!collapsed.has(node.path) && renderNodes(node.children, depth + 1)}
        </div>
      ),
    );

  const copy = async () => {
    if (text === null) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code">
      <nav className="tree" aria-label="Generated files">
        <div className="tree__root">{result.projectName}/</div>
        {renderNodes(tree, 0)}
      </nav>
      <div className="code__view">
        <div className="toolbar">
          <span className="toolbar__title mono">{file?.path}</span>
          {text !== null && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
              {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
        {text !== null ? (
          <div className="code__scroll">
            <pre className="code__gutter" aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
            </pre>
            <pre className="code__text">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        ) : (
          <div className="code__binary">
            Binary file · {formatBytes((file?.data as Uint8Array | undefined)?.byteLength ?? 0)}
          </div>
        )}
      </div>
    </div>
  );
}
