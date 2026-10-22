import type { DefaultTreeAdapterMap } from "parse5";

export type Node = DefaultTreeAdapterMap["node"];
export type ParentNode = DefaultTreeAdapterMap["parentNode"];
export type ChildNode = DefaultTreeAdapterMap["childNode"];
export type Element = DefaultTreeAdapterMap["element"];
export type TextNode = DefaultTreeAdapterMap["textNode"];
export type Document = DefaultTreeAdapterMap["document"];

export const HTML_NS: string = "http://www.w3.org/1999/xhtml";
export const SVG_NS: string = "http://www.w3.org/2000/svg";

export function isElement(node: Node): node is Element {
  return "tagName" in node;
}

export function isText(node: Node): node is TextNode {
  return node.nodeName === "#text";
}

export function getAttr(el: Element, name: string): string | null {
  const attr = el.attrs.find((a) => a.name === name && !a.prefix);
  return attr ? attr.value : null;
}

export function hasAttr(el: Element, name: string): boolean {
  return getAttr(el, name) !== null;
}

export function childElements(node: ParentNode): Element[] {
  return node.childNodes.filter(isElement);
}

/** Depth-first walk over descendant elements. Return `false` from `visit` to skip an element's children. */
export function walkElements(node: ParentNode, visit: (el: Element) => boolean | void): void {
  for (const child of node.childNodes) {
    if (!isElement(child)) continue;
    if (visit(child) === false) continue;
    walkElements(child, visit);
  }
}

export function findAll(node: ParentNode, predicate: (el: Element) => boolean): Element[] {
  const found: Element[] = [];
  walkElements(node, (el) => {
    if (predicate(el)) found.push(el);
  });
  return found;
}

export function findFirst(node: ParentNode, predicate: (el: Element) => boolean): Element | null {
  for (const child of node.childNodes) {
    if (!isElement(child)) continue;
    if (predicate(child)) return child;
    const inner = findFirst(child, predicate);
    if (inner) return inner;
  }
  return null;
}

export function textContent(node: Node): string {
  if (isText(node)) return node.value;
  if ("childNodes" in node) return node.childNodes.map(textContent).join("");
  return "";
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function classList(el: Element): string[] {
  return (getAttr(el, "class") ?? "").split(/\s+/).filter(Boolean);
}

export function countElements(node: ParentNode): number {
  let count = 0;
  walkElements(node, () => {
    count++;
  });
  return count;
}

/** A detached element that borrows another element's children, used to wrap a <body> as a page root. */
export function createSyntheticElement(
  tagName: string,
  attrs: Element["attrs"],
  childNodes: ChildNode[],
): Element {
  return {
    nodeName: tagName,
    tagName,
    attrs,
    namespaceURI: HTML_NS,
    childNodes,
    parentNode: null,
  } as unknown as Element;
}
