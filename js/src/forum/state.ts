import type Post from 'flarum/common/models/Post';

import type Highlight from './models/Highlight';

/**
 * The marks on a post.
 *
 * They arrive with the post itself — the API carries them as a relationship —
 * so there is no loading to do here. What this does hold is the difference
 * between what the server sent and what the reader has done since: a mark made
 * a moment ago is not in the post's relationship, and one just removed still
 * is.
 */
const added = new Map<string, Highlight[]>(); // post id -> Highlight[]
const removed = new Set<string>(); // highlight id

function relationship(post: Post): Highlight[] {
  return (post.marginaliaHighlights() || []).filter((highlight): highlight is Highlight => !!highlight);
}

export function highlightsFor(post: Post | null): Highlight[] {
  if (!post) return [];

  const local = added.get(String(post.id())) || [];
  const seen = new Set<string>();

  return [...relationship(post), ...local].filter((highlight) => {
    const id = String(highlight.id());

    if (seen.has(id) || removed.has(id)) return false;

    seen.add(id);

    return true;
  });
}

export function remember(post: Post, highlight: Highlight): void {
  const id = String(post.id());

  if (!added.has(id)) added.set(id, []);

  added.get(id)!.push(highlight);
  repaint(post);
}

export function forget(post: Post, highlight: Highlight): void {
  removed.add(String(highlight.id()));
  repaint(post);
}

/**
 * Let the post draw its marks again on the next redraw.
 *
 * 🚨 Core's Post component only re-renders when the post's `freshness`
 * changes, and painting happens in its `onupdate`. A mark added, removed or
 * made public changes nothing core tracks, so without this the post keeps
 * its old DOM and the change shows only after a reload.
 */
export function repaint(post: Post): void {
  post.freshness = new Date();
}
