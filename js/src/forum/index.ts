import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import type Post from 'flarum/common/models/Post';
import type CommentPost from 'flarum/forum/components/CommentPost';
import type Mithril from 'mithril';

import Layer, { showToolbar, showPopup, dismiss } from './components/Layer';
import { describeSelection } from './utils/anchor';
import { paint } from './utils/paint';

export { default as extend } from './extend';

/*
 * 🚨 The extends name a module PATH, not an imported component: CommentPost is
 * code-split, so an import resolves to a registry lookup at boot, before the
 * chunk exists, and `extend(undefined.prototype, …)` takes the whole forum
 * bundle down rather than just this extension.
 */
app.initializers.add('ernestdefoe-marginalia', () => {
  mountLayer();

  (['oncreate', 'onupdate'] as const).forEach((hook) => {
    extend('flarum/forum/components/CommentPost', hook, function (this: CommentPost, _: unknown, vnode: Mithril.VnodeDOM) {
      try {
        paint(vnode.dom as HTMLElement, this.attrs.post);
      } catch {
        // Deliberately quiet: this runs inside a lifecycle hook on every
        // redraw, where a throw does not cost a highlight, it stops Mithril
        // and empties the page. A post whose body cannot be painted is shown
        // exactly as written, which is the right fallback, and an alert here
        // would repeat on every redraw.
      }
    });
  });
});

function mountLayer(): void {
  const host = document.createElement('div');

  host.className = 'Marginalia-host';
  document.body.appendChild(host);
  m.mount(host, Layer);

  // 🚨 `mouseup` on the document, not a handler per post. Posts come and go as
  // the stream scrolls, and a selection routinely starts in one element and
  // ends in another — the browser only settles it once the button is up.
  document.addEventListener('mouseup', (e) => {
    if (target(e)?.closest('.Marginalia-chrome')) return;

    // Let the browser finish resolving the selection first.
    setTimeout(() => onSelection(e), 0);
  });

  document.addEventListener('mousedown', (e) => {
    if (target(e)?.closest('.Marginalia-chrome')) return;

    const mark = target(e)?.closest('.Marginalia-mark');

    if (mark) return; // handled on click, below

    dismiss();
  });

  document.addEventListener('click', (e) => {
    const mark = target(e)?.closest<HTMLElement>('.Marginalia-mark');

    if (!mark) return;

    const post = postFor(mark);

    if (!post) return;

    e.preventDefault();
    showPopup(post, (mark.dataset.marginaliaIds || '').split(',').filter(Boolean), anchorRect(mark.getBoundingClientRect()));
  });
}

function onSelection(e: MouseEvent): void {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) {
    onCollapsed(e);

    return;
  }

  const body = target(e)?.closest<HTMLElement>('.Post-body');
  const description = body && canMark() ? describeSelection(body, selection) : null;
  const post = body ? postFor(body) : null;

  if (!body || !description || !post) {
    // A reader who may not mark anything gets no toolbar, but an open one
    // from before still closes.
    dismiss();

    return;
  }

  showToolbar(post, description, anchorRect(selection.getRangeAt(0).getBoundingClientRect()));
}

/*
 * 🚨 A collapsed selection on a MARK is somebody clicking that mark to
 * read its note — and this function is running late, on the timeout the
 * mouseup handler scheduled. By now the `click` listener in mountLayer()
 * has already opened the popup, so dismissing here closes the thing the
 * reader just asked for.
 *
 * What that looks like depends entirely on how fast the machine is.
 * Mithril batches redraws into an animation frame, so if the frame lands
 * between the two the popup appears and vanishes — reported as "it
 * appears and disappears like a flash, or a star twinkling" — and if it
 * does not, the popup never draws at all and the notes feature simply
 * looks unfinished. Same bug, two symptoms, neither of them near the
 * cause.
 *
 * A click somewhere else still dismisses, and so does the mousedown
 * handler in mountLayer(), so nothing is left open that should not be.
 */
function onCollapsed(e: MouseEvent): void {
  if (!target(e)?.closest('.Marginalia-mark')) {
    dismiss();
  }
}

function canMark(): boolean {
  return !!app.session.user && !!app.forum.attribute('canMarginaliaHighlight');
}

function target(e: Event): Element | null {
  return e.target instanceof Element ? e.target : null;
}

/**
 * Which post a DOM node belongs to.
 *
 * 🚨 Read from the attribute paint() stamps, with core's own stream wrapper as
 * the fallback. The obvious `article.id` is empty in Flarum 2 — nothing writes
 * `post-123` any more — and a selection handler that cannot name its post
 * silently does nothing at all, which is exactly how this first behaved.
 */
function postFor(node: Element): Post | null {
  const stamped = node.closest<HTMLElement>('[data-marginalia-post]')?.dataset.marginaliaPost;
  const id = stamped || node.closest<HTMLElement>('.PostStream-item')?.dataset.id;

  return (id && app.store.getById<Post>('posts', id)) || null;
}

function anchorRect(rect: DOMRect): { top: number; left: number } {
  return {
    top: rect.bottom + window.scrollY + 8,
    left: Math.max(12, rect.left + window.scrollX),
  };
}
