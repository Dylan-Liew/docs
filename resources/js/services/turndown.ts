import { highlightedCodeBlock, strikethrough, tables } from '@guyplusplus/turndown-plugin-gfm';
import TurndownService from 'turndown';

TurndownService.prototype.escape = (string: string): string => string;

export const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    linkReferenceStyle: 'shortcut',
})
    .use([highlightedCodeBlock, strikethrough, tables])
    .addRule('listItem', {
        filter: 'li',
        replacement(content: string, node: Node, options: TurndownService.Options): string {
            const element = node as HTMLLIElement;

            let prefix = (options.bulletListMarker ?? '-') + ' ';
            const parent = element.parentNode as HTMLElement | null;

            if (parent?.nodeName === 'OL') {
                const olParent = parent as HTMLOListElement;
                const start = olParent.getAttribute('start');
                const index = Array.prototype.indexOf.call(olParent.children, element);
                prefix = (start ? Number(start) + index : index + 1) + '. ';
            }

            const indent = ' '.repeat(prefix.length);

            if (element.dataset.type === 'taskItem') {
                prefix += element.dataset.checked === 'true' ? '[x] ' : '[ ] ';
            }

            content = content
                .replace(/^\n+/, '') // Remove leading newlines
                .replace(/\n+$/, '\n') // Replace trailing newlines with just one
                .replace(/\n/gm, '\n' + indent) // Indent nested content
                .replace(/^[^\S\n]+$\n?/gm, ''); // Remove lines containing only whitespaces

            return prefix + content + (element.nextSibling && !content.endsWith('\n') ? '\n' : '');
        },
    })
    .addRule('image', {
        filter: 'img',
        replacement(content: string, node: Node): string {
            const element = node as HTMLImageElement;
            const alt = element.getAttribute('alt') ?? '';
            const src = element.getAttribute('src')?.replace(/^\/files\/\d+\?path=/, '');
            const title = element.getAttribute('title');
            const titlePart = title ? ` "${title}"` : '';

            if (!src) {
                return content;
            }

            try {
                return `![${alt}](${decodeURI(src)}${titlePart})`;
            } catch {
                return `![${alt}](${src}${titlePart})`;
            }
        },
    })
    .addRule('link', {
        filter: 'a',
        replacement(content: string, node: Node): string {
            const element = node as HTMLAnchorElement;
            const href = element.getAttribute('href');
            const title = element.getAttribute('title');
            const titlePart = title ? ` "${title}"` : '';
            const autoLink = element.classList.contains('autoLink');
            const angleBracketLink = element.dataset.angleBracket === 'true';

            if (!href) {
                return content;
            }

            let cleanHref: string;

            try {
                cleanHref = decodeURI(href);
            } catch {
                cleanHref = href;
            }

            if (autoLink) {
                return cleanHref.replace(/^mailto:/, '');
            }

            if (angleBracketLink) {
                return `<${cleanHref.replace(/^mailto:/, '')}>`;
            }

            return `[${content}](${cleanHref}${titlePart})`;
        },
    })
    .addRule('hashtag', {
        filter: (node: Node): boolean => {
            const element = node as HTMLElement;

            return element.nodeName === 'SPAN' && element.dataset.hashtag === 'true';
        },
        replacement(content: string, node: Node): string {
            const element = node as HTMLElement;
            const escaped = element.dataset.escaped === 'true';

            return escaped ? `\\${content}` : content;
        },
    });

// Incremental serialization. Turndown converts a document by joining each
// top-level element's replacement with join(), and whitespace collapsing resets
// at block boundaries, so a top-level block's replacement does not depend on
// its neighbours. Replacements can therefore be cached per block and joined
// with the same rules, giving output identical to turndown(wholeDocument).

const blockElement =
    '(?:address|article|aside|audio|blockquote|canvas|center|dd|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|li|main|menu|nav|noframes|noscript|ol|output|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)';
const startsWithBlock = new RegExp(`^<${blockElement}[\\s>/]`, 'i');
const endsWithBlock = new RegExp(`(?:</${blockElement}>|<hr[^>]*>)$`, 'i');

// Returns Turndown's untrimmed replacement for one top-level block, or null
// when the HTML is not a block (the caller then converts the whole document).
export function blockReplacement(html: string): string | null {
    if (!startsWithBlock.test(html) || !endsWithBlock.test(html)) {
        return null;
    }

    // Text sentinels keep the block's leading/trailing newlines, which
    // turndown() would otherwise trim from the ends of its output.
    const output = turndownService.turndown(`A${html}B`);

    return output.startsWith('A') && output.endsWith('B') ? output.slice(1, -1) : null;
}

// Equivalent to reducing replacements with Turndown's join() and postProcess(),
// without re-copying the accumulated output for every block.
export function joinReplacements(replacements: string[]): string {
    const parts: string[] = [];
    let trailing = 0;

    for (const replacement of replacements) {
        let start = 0;
        let end = replacement.length;

        while (start < end && replacement[start] === '\n') start++;
        while (end > start && replacement[end - 1] === '\n') end--;

        const separator = Math.min(2, Math.max(trailing, start));

        if (start === end) {
            trailing = separator;
            continue;
        }

        parts.push('\n\n'.slice(0, separator), replacement.slice(start, end));
        trailing = replacement.length - end;
    }

    return (parts.join('') + '\n\n'.slice(0, trailing))
        .replace(/^[\t\r\n]+/, '')
        .replace(/[\t\r\n\s]+$/, '');
}
