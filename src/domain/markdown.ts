import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

interface AstNode {
  type: string;
  value?: string;
  meta?: string | null;
  checked?: boolean | null;
  children?: AstNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}
const parser = unified().use(remarkParse).use(remarkGfm);
const parse = (markdown: string): AstNode => parser.parse(markdown) as AstNode;
function plainText(node: AstNode): string {
  return (
    node.value ??
    node.children
      ?.filter((child) => child.type !== 'list')
      .map(plainText)
      .join('') ??
    ''
  );
}
export interface ChecklistItem {
  index: number;
  checked: boolean;
  text: string;
  markerOffset: number;
  depth: number;
}
export function parseChecklist(markdown: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  function walk(node: AstNode, depth: number) {
    if (
      node.type === 'listItem' &&
      typeof node.checked === 'boolean' &&
      node.position?.start.offset !== undefined
    ) {
      const start = node.position.start.offset;
      const marker = /^(?:[-+*]|\d+[.)])[ \t]+\[([ xX])\]/u.exec(markdown.slice(start));
      if (marker)
        items.push({
          index: items.length,
          checked: node.checked,
          text: plainText(node),
          markerOffset: start + marker[0].length - 2,
          depth: Math.max(0, depth - 1),
        });
    }
    for (const child of node.children ?? []) walk(child, depth + (node.type === 'listItem' ? 1 : 0));
  }
  walk(parse(markdown), 1);
  return items;
}
export function toggleChecklistItem(markdown: string, index: number): string {
  const item = parseChecklist(markdown)[index];
  if (!item) return markdown;
  return (
    markdown.slice(0, item.markerOffset) + (item.checked ? ' ' : 'x') + markdown.slice(item.markerOffset + 1)
  );
}
export function isSimpleChecklist(markdown: string): boolean {
  const root = parse(markdown);
  if (!root.children?.length) return false;
  function validList(node: AstNode): boolean {
    return (
      node.type === 'list' &&
      !!node.children?.length &&
      node.children.every(
        (item) =>
          item.type === 'listItem' &&
          typeof item.checked === 'boolean' &&
          !!item.children?.length &&
          item.children.every((child) => child.type === 'paragraph' || validList(child)),
      )
    );
  }
  return root.children.every(validList);
}
export function checkVisualSupport(markdown: string): { supported: boolean; reason?: string } {
  // YAML-style frontmatter has meaning outside CommonMark; treating it as rules/headings would lose that meaning.
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(markdown);
  if (frontmatter && /(?:^|\n)[\w-]+\s*:/u.test(frontmatter[1]!))
    return { supported: false, reason: 'extension' };
  let reason: string | undefined;
  function walk(node: AstNode) {
    if (node.type === 'code' || node.type === 'inlineCode') {
      if (node.type === 'code' && node.meta) reason = 'extension';
      return;
    }
    if (node.type === 'html') reason = 'html';
    if (node.type.startsWith('footnote')) reason = 'extension';
    if (
      node.type === 'text' &&
      node.value &&
      /(?:\$[^$\n]+\$|\$\$|(?:^|\n):{2,}\w|\[\^[^\]]+\]|\[\[[^\]]+\]\]|(?:^|\n)\s*(?:==|\+\+)[^\n]+(?:==|\+\+))/u.test(
        node.value,
      )
    )
      reason = 'extension';
    for (const child of node.children ?? []) walk(child);
  }
  walk(parse(markdown));
  return reason ? { supported: false, reason } : { supported: true };
}
