

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function blockToHtml(block) {
  if (block.type === 'block') {
    const tag =
      block.style === 'title'
        ? 'h1'
        : block.style === 'heading'
        ? 'h2'
        : 'p';
    const cls = block.style === 'small' ? ' class="small"' : '';
    const align = block.align ? ` style="text-align:${block.align}"` : '';
    const text = escapeHtml(block.text || '') || '<br>';
    return `<${tag}${cls}${align}>${text}</${tag}>`;  
  }

  if (block.type === 'numbered') {
    const text = escapeHtml(block.text || '');
    const num = escapeHtml(block.number || '•');
    return `<p class="numbered"><span class="num">${num}</span> ${text || '<br>'}</p>`;
  }

  if (block.type === 'row') {
    const left = escapeHtml(block.left || '') || '<br>';
    const right = escapeHtml(block.right || '') || '<br>';
    return `<table class="two-col"><tbody><tr><td>${left}</td><td>${right}</td></tr></tbody></table>`;
  }

  if (block.type === 'spacer') {
    const size = block.size || 'md';
    const px = size === 'sm' ? 8 : size === 'lg' ? 36 : 18;
    return `<div class="spacer" data-size="${size}" style="height:${px}px"></div>`;
  }

  return '';
}

function blocksToPages(blocks) {
  const pages = [];
  let buffer = [];

  for (const block of blocks) {
    if (block.type === 'page-break') {
      pages.push(buffer.join(''));
      buffer = [];
      continue;
    }
    buffer.push(blockToHtml(block));
  }

  pages.push(buffer.join(''));
  return pages.length > 0 ? pages : ['<p><br></p>'];
}

export function toTemplate(raw) {
  if (Array.isArray(raw.pages) && raw.pages.length > 0) {
    return { ...raw, pages: raw.pages };
  }

  return {
    ...raw,
    pages: Array.isArray(raw.blocks) ? blocksToPages(raw.blocks) : ['<p><br></p>'],
  };
}

