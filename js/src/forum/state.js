/**
 * The marks on a post.
 *
 * They arrive with the post itself — the API carries them as a relationship —
 * so there is no loading to do here. What this does hold is the difference
 * between what the server sent and what the reader has done since: a mark made
 * a moment ago is not in the post's relationship, and one just removed still
 * is.
 */
const added = new Map(); // post id -> Highlight[]
const removed = new Set(); // highlight id

export function highlightsFor(post) {
  if (!post) return [];

  const fromPost = (post.marginaliaHighlights?.() || []).filter(Boolean);
  const local = added.get(String(post.id())) || [];

  const seen = new Set();

  return [...fromPost, ...local].filter((highlight) => {
    const id = String(highlight.id());

    if (seen.has(id) || removed.has(id)) return false;

    seen.add(id);

    return true;
  });
}

export function remember(post, highlight) {
  const id = String(post.id());

  if (!added.has(id)) added.set(id, []);

  added.get(id).push(highlight);
}

export function forget(highlight) {
  removed.add(String(highlight.id()));
}
