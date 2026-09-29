import { marked, type Token, type Tokens } from 'marked';
import { angleBracketLink } from './marked/extension-angle-bracket-link';
import { hashtag } from './marked/extension-hashtag';

const renderer = new marked.Renderer();

function escape(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Raw HTML stays literal outside explicit, sandboxed code-block previews.
renderer.html = ({ text }) => escape(text);

renderer.link = function ({ href, raw, text, title }: Tokens.Link): string {
    // Skip autolinking URLs/emails in plain Markdown text
    if (raw === text) {
        return text;
    }

    const classAttr = raw === href ? ' class="autoLink"' : '';
    const titleAttr = title ? ` title="${title}"` : '';

    return `<a href="${href}"${classAttr}${titleAttr}>${text}</a>`;
};

renderer.list = function (token: Tokens.List): string {
    const { ordered, items, start } = token;
    const taskList = items[0]?.task === true;
    const type = ordered ? 'ol' : 'ul';

    let body = '';

    for (const item of items) {
        body += this.listitem(item);
    }

    let startAttr = '';

    if (taskList) {
        startAttr = ' data-type="taskList"';
    } else if (ordered && start !== 1) {
        startAttr = ` start="${start}"`;
    }

    return `<${type}${startAttr}>\n${body}</${type}>\n`;
};

renderer.listitem = function (item: Tokens.ListItem): string {
    let itemAttr = '';

    if (item.task) {
        const checkedAttr = item.checked ? 'true' : 'false';
        itemAttr = ` data-type="taskItem" data-checked="${checkedAttr}"`;

        if (item.loose) {
            const firstToken = item.tokens[0];
            const hasParagraphWithText =
                firstToken?.type === 'paragraph' &&
                (firstToken as Tokens.Paragraph).tokens?.length > 0 &&
                (firstToken as Tokens.Paragraph).tokens[0].type === 'text';

            if (hasParagraphWithText) {
                ((firstToken as Tokens.Paragraph).tokens[0] as Tokens.Text).escaped = true;
            } else {
                // Prepend empty text token
                item.tokens.unshift({
                    type: 'text',
                    raw: '',
                    text: '',
                    escaped: true,
                } satisfies Tokens.Text);
            }
        }
    }

    const itemBody = this.parser.parse(item.tokens);

    return `<li${itemAttr}>${itemBody}</li>\n`;
};

renderer.code = function ({ text, lang }: Tokens.Code): string {
    const langClass = lang ? ` class="language-${escape(lang.split(/\s+/)[0])}"` : '';

    return `<pre><code${langClass}>${escape(text)}</code></pre>`;
};

renderer.codespan = function ({ text }: Tokens.Codespan): string {
    return `<code>${escape(text)}</code>`;
};

marked.use({
    extensions: [angleBracketLink, hashtag],
    walkTokens(token: Token): void {
        if (token.type !== 'list_item' || token.task) {
            return;
        }

        const match = /^\s*[-*+]\s+\[([ xX])\]\s*$/.exec(token.raw);

        if (!match) {
            return;
        }

        token.task = true;
        token.checked = match[1].toLowerCase() === 'x';
        token.text = '';
        token.tokens = [];
    },
});

export const markedService = marked.setOptions({ renderer });
