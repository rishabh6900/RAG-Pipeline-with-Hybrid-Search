/**
 * High-Fidelity Markdown, Math & Table Formatter for RAG Answers and Citations.
 */

export function formatMarkdownHtml(raw: string, options: { enableCitations?: boolean; isCitationView?: boolean } = { enableCitations: true }): string {
  if (!raw) return '';

  let text = raw.trim();

  // 1. Pre-process LaTeX Math notations
  text = text
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\le|\\leq/g, '≤')
    .replace(/\\ge|\\geq/g, '≥')
    .replace(/\\ne|\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\in/g, '∈')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\infty/g, '∞')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\mathit\{([^}]+)\}/g, '<em>$1</em>')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\\(([\s\S]*?)\\\)/g, '<span class="math-expr">$1</span>')
    .replace(/\\\[([\s\S]*?)\\\]/g, '<div class="math-block">$1</div>');

  // 2. Fenced Code Blocks: ```lang ... ```
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(
      `<div class="code-block-container"><div class="code-lang-tag">${lang || 'code'}</div><pre class="code-pre"><code>${escapeHtml(code.trim())}</code></pre></div>`
    );
    return placeholder;
  });

  // 3. Inline Code: `code`
  text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  });

  // 4. Pre-process Markdown Tables (multi-line & inline concatenated formats)
  text = renderMarkdownTables(text);

  // 5. Section Headers: #, ##, ###, #### (including inline headers like "### Title")
  text = text.replace(/(?:^|\n)####\s+(.+)$/gm, '\n<h4 class="ans-h4">$1</h4>\n');
  text = text.replace(/(?:^|\n)###\s+(.+)$/gm, '\n<h3 class="ans-h3">$1</h3>\n');
  text = text.replace(/(?:^|\n)##\s+(.+)$/gm, '\n<h2 class="ans-h2">$1</h2>\n');
  text = text.replace(/(?:^|\n)#\s+(.+)$/gm, '\n<h1 class="ans-h1">$1</h1>\n');

  // Handle inline "### Title" without newline
  text = text.replace(/\s+###\s+([^#\n]+)/g, '<h3 class="ans-h3">$1</h3>');

  // 6. Bold & Italic Markdown
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="ans-bold">$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong class="ans-bold">$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="ans-italic">$1</em>');

  // 7. Inline Citations: [1], [2], [1, 2]
  if (options.enableCitations !== false) {
    text = text.replace(/\[(\d+)\]/g, '<span class="citation-chip-inline" data-cit="$1" title="Inspect citation [$1]">[$1]</span>');
  }

  // 8. Bullet Lists & Numbered Lists
  text = renderLists(text);

  // 9. Clean awkward punctuation spacing (e.g. "BSTs )" -> "BSTs)", "tree ," -> "tree,")
  text = text
    .replace(/\s+([,.:;!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');

  // 10. Paragraph Division
  text = renderParagraphs(text);

  // 11. Restore Code Blocks
  codeBlocks.forEach((cb, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, cb);
  });

  return text;
}

function renderMarkdownTables(text: string): string {
  // Normalize inline tables that were serialized onto a single line:
  // e.g. "| Type | Rule | |---|---| | Row1 | Val1 | | Row2 | Val2 |"
  text = text.replace(/\|\s*\|\s*(?=[A-Za-z0-9_\-*`[#])/g, '|\n| ');

  // Split lines and identify table blocks
  const lines = text.split('\n');
  const output: string[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableLine = line.startsWith('|') && line.endsWith('|') && line.length > 2;

    if (isTableLine) {
      inTable = true;
      tableBuffer.push(line);
    } else {
      if (inTable) {
        output.push(convertTableBufferToHtml(tableBuffer));
        tableBuffer = [];
        inTable = false;
      }
      output.push(lines[i]);
    }
  }

  if (inTable && tableBuffer.length > 0) {
    output.push(convertTableBufferToHtml(tableBuffer));
  }

  return output.join('\n');
}

function convertTableBufferToHtml(tableLines: string[]): string {
  if (tableLines.length === 0) return '';

  const rows = tableLines.map(line => {
    // Strip leading and trailing pipe and split by pipe
    const clean = line.replace(/^\||\|$/g, '');
    return clean.split('|').map(cell => cell.trim());
  });

  if (rows.length === 0) return '';

  // Check if row 1 is separator |---|---|
  let headerRow = rows[0];
  let bodyRows: string[][] = [];
  let isSepIndex = -1;

  for (let r = 0; r < rows.length; r++) {
    const isSep = rows[r].every(c => /^:?-+:?$/.test(c.replace(/\s+/g, '')));
    if (isSep) {
      isSepIndex = r;
      break;
    }
  }

  if (isSepIndex === 1) {
    headerRow = rows[0];
    bodyRows = rows.slice(2);
  } else if (isSepIndex > 1) {
    headerRow = rows[0];
    bodyRows = rows.filter((_, idx) => idx !== isSepIndex);
  } else {
    // No separator found, assume first row is header
    headerRow = rows[0];
    bodyRows = rows.slice(1);
  }

  let html = '<div class="table-responsive-container"><table class="ans-table"><thead><tr>';
  headerRow.forEach(h => {
    html += `<th>${h}</th>`;
  });
  html += '</tr></thead><tbody>';

  bodyRows.forEach(row => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;
    html += '<tr>';
    // Pad row with empty cells if column count mismatch
    for (let c = 0; c < headerRow.length; c++) {
      const val = row[c] || '';
      html += `<td>${val}</td>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function renderLists(text: string): string {
  // Convert bullet items
  text = text.replace(/(?:^|\n)\s*[-*•]\s+(.+)$/gm, '\n<li class="ans-li">$1</li>');
  // Wrap contiguous <li> into <ul>
  text = text.replace(/(<li class="ans-li">[\s\S]*?<\/li>)(?!\s*<li class="ans-li">)/g, '<ul class="ans-ul">$1</ul>');

  // Convert numbered list items
  text = text.replace(/(?:^|\n)\s*(\d+)\.\s+(.+)$/gm, '\n<li class="ans-oli" data-num="$1">$2</li>');
  text = text.replace(/(<li class="ans-oli"[^>]*>[\s\S]*?<\/li>)(?!\s*<li class="ans-oli")/g, '<ol class="ans-ol">$1</ol>');

  return text;
}

function renderParagraphs(text: string): string {
  const parts = text.split(/\n\s*\n/);
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      if (
        p.startsWith('<div') ||
        p.startsWith('<table') ||
        p.startsWith('<ul') ||
        p.startsWith('<ol') ||
        p.startsWith('<h1') ||
        p.startsWith('<h2') ||
        p.startsWith('<h3') ||
        p.startsWith('<h4')
      ) {
        return p;
      }
      return `<p class="ans-p">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
