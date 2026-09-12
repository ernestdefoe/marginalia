/**
 * Where a marked passage is, now.
 *
 * A highlight is stored against the post's PLAIN TEXT — an offset, the passage
 * itself, and a little context either side. Not against the HTML, and not
 * against DOM nodes: both change when the post is edited, when an extension
 * decorates the body, or when a theme renders it differently, and a highlight
 * anchored to any of them would drift onto the wrong words.
 *
 * 🚨 Wrapping our own marks does not move anything, because wrapping text in a
 * span leaves `textContent` byte-identical. That is the property this whole
 * approach rests on, and it is why the marks are drawn with spans rather than
 * by rewriting the body's HTML.
 */

/** Every text node under `root`, with the running offset each one starts at. */
export function textNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Ignore anything we or another extension injected as chrome — a
      // "edited since quoted" marker is not part of the post's words.
      if (node.parentElement?.closest('.Marginalia-chrome, .Verbatim-marker, script, style')) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  let offset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;

    nodes.push({ node, start: offset, end: offset + node.data.length });
    offset += node.data.length;
  }

  return nodes;
}

export function plainText(root) {
  return textNodes(root)
    .map((n) => n.node.data)
    .join('');
}

/**
 * Find the passage in the post as it stands now.
 *
 * Three attempts, cheapest first, and it is allowed to fail: a passage that
 * has been edited away is simply not drawn. Guessing would put somebody's mark
 * on words they never marked.
 */
export function locate(text, highlight) {
  const quoted = highlight.quoted;

  if (!quoted) return null;

  // 1. Exactly where it was. The overwhelmingly common case — most posts are
  //    never edited at all.
  if (text.substr(highlight.start, quoted.length) === quoted) {
    return { start: highlight.start, length: quoted.length };
  }

  // 2. With its context, which survives the passage appearing twice in a post.
  const prefix = highlight.prefix || '';
  const suffix = highlight.suffix || '';

  if (prefix || suffix) {
    const withContext = text.indexOf(prefix + quoted + suffix);

    if (withContext !== -1) {
      return { start: withContext + prefix.length, length: quoted.length };
    }
  }

  // 3. The passage alone, nearest to where it used to be — a paragraph added
  //    above should not orphan every mark below it.
  const candidates = [];
  let at = text.indexOf(quoted);

  while (at !== -1 && candidates.length < 20) {
    candidates.push(at);
    at = text.indexOf(quoted, at + 1);
  }

  if (!candidates.length) return null;

  const nearest = candidates.reduce((best, c) => (Math.abs(c - highlight.start) < Math.abs(best - highlight.start) ? c : best));

  return { start: nearest, length: quoted.length };
}

/** A DOM Range covering [start, start + length) of the plain text. */
export function rangeFor(root, start, length) {
  const nodes = textNodes(root);
  const end = start + length;

  let range = null;

  for (const entry of nodes) {
    if (!range && entry.end > start) {
      range = document.createRange();
      range.setStart(entry.node, start - entry.start);
    }

    if (range && entry.end >= end) {
      range.setEnd(entry.node, end - entry.start);

      return range;
    }
  }

  return null;
}

/**
 * Turn the reader's selection into something storable: offsets into the plain
 * text, the passage itself, and up to 40 characters of context either side.
 */
export function describeSelection(root, selection) {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);

  if (!root.contains(range.commonAncestorContainer)) return null;

  const nodes = textNodes(root);
  const offsetOf = (node, offset) => {
    const entry = nodes.find((n) => n.node === node);

    return entry ? entry.start + offset : null;
  };

  const start = offsetOf(range.startContainer, range.startOffset);
  const end = offsetOf(range.endContainer, range.endOffset);

  if (start === null || end === null || end <= start) return null;

  const text = nodes.map((n) => n.node.data).join('');

  // 🚨 Trim by moving the OFFSETS, not by trimming the string afterwards.
  // A selection that starts on a space is normal — double-clicking a word
  // often produces one — and storing the untrimmed offset next to the trimmed
  // passage means the anchor no longer matches itself, so every mark would
  // take the slow re-anchoring path the moment it was drawn.
  let from = start;
  let to = end;

  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;

  const quoted = text.slice(from, to);

  if (quoted.length < 2) return null;

  return {
    start: from,
    length: quoted.length,
    quoted,
    prefix: text.slice(Math.max(0, from - 40), from),
    suffix: text.slice(to, to + 40),
  };
}
