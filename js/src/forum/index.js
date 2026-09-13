import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Model from 'flarum/common/Model';
import Post from 'flarum/common/models/Post';

import Highlight from './models/Highlight';

import Layer, { showToolbar, showPopup, dismiss } from './components/Layer';
import { describeSelection } from './utils/anchor';
import { paint } from './utils/paint';

/*
 * 🚨 The extends name a module PATH, not an imported component: CommentPost is
 * code-split, so an import resolves to a registry lookup at boot, before the
 * chunk exists, and `extend(undefined.prototype, …)` takes the whole forum
 * bundle down rather than just this extension.
 */
app.initializers.add('ernestdefoe-marginalia', () => {
  /*
   * 🚨 Both halves are needed, and neither fails loudly without the other.
   * Without the store registration the payload's marks are dropped on arrival;
   * without the relationship `post.marginaliaHighlights` is simply not a
   * function, and the only symptom is that nothing is ever drawn.
   *
   * Models are in the common bundle rather than code-split, so importing Post
   * here is safe — unlike CommentPost below.
   */
  app.store.models['marginalia-highlights'] = Highlight;
  Post.prototype.marginaliaHighlights = Model.hasMany('marginaliaHighlights');

  mountLayer();

  ['oncreate', 'onupdate'].forEach((hook) => {
    extend('flarum/forum/components/CommentPost', hook, function (_, vnode) {
      // Wrapped: this runs inside a lifecycle hook, where a throw does not
      // cost a highlight, it stops Mithril and empties the page.
      try {
        paint(vnode.dom, this.attrs.post);
      } catch (e) {
        console.error('[marginalia] leaving this post alone:', e);
      }
    });
  });
});

function mountLayer() {
  const host = document.createElement('div');

  host.className = 'Marginalia-host';
  document.body.appendChild(host);
  m.mount(host, Layer);

  // 🚨 `mouseup` on the document, not a handler per post. Posts come and go as
  // the stream scrolls, and a selection routinely starts in one element and
  // ends in another — the browser only settles it once the button is up.
  document.addEventListener('mouseup', (e) => {
    if (e.target.closest?.('.Marginalia-chrome')) return;

    // Let the browser finish resolving the selection first.
    setTimeout(() => onSelection(e), 0);
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest?.('.Marginalia-chrome')) return;

    const mark = e.target.closest?.('.Marginalia-mark');

    if (mark) return; // handled on click, below

    dismiss();
  });

  document.addEventListener('click', (e) => {
    const mark = e.target.closest?.('.Marginalia-mark');

    if (!mark) return;

    const post = postFor(mark);

    if (!post) return;

    e.preventDefault();
    showPopup(post, (mark.dataset.marginaliaIds || '').split(',').filter(Boolean), anchorRect(mark.getBoundingClientRect()));
  });
}

function onSelection(e) {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) {
    /*
     * 🚨 A collapsed selection on a MARK is somebody clicking that mark to
     * read its note — and this function is running late, on the timeout the
     * mouseup handler scheduled. By now the `click` listener below has
     * already opened the popup, so dismissing here closes the thing the
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
     * handler above, so nothing is left open that should not be.
     */
    if (!e.target.closest?.('.Marginalia-mark')) {
      dismiss();
    }

    return;
  }

  const body = e.target.closest?.('.Post-body');

  if (!body) {
    dismiss();

    return;
  }

  if (!app.session.user || !app.forum.attribute('canMarginaliaHighlight')) return;

  const post = postFor(body);

  if (!post) return;

  const description = describeSelection(body, selection);

  if (!description) {
    dismiss();

    return;
  }

  showToolbar(post, description, anchorRect(selection.getRangeAt(0).getBoundingClientRect()));
}

/**
 * Which post a DOM node belongs to.
 *
 * 🚨 Read from the attribute paint() stamps, with core's own stream wrapper as
 * the fallback. The obvious `article.id` is empty in Flarum 2 — nothing writes
 * `post-123` any more — and a selection handler that cannot name its post
 * silently does nothing at all, which is exactly how this first behaved.
 */
function postFor(node) {
  const stamped = node.closest?.('[data-marginalia-post]')?.dataset?.marginaliaPost;
  const id = stamped || node.closest?.('.PostStream-item')?.dataset?.id;

  return id ? app.store.getById('posts', id) : null;
}

function anchorRect(rect) {
  return {
    top: rect.bottom + window.scrollY + 8,
    left: Math.max(12, rect.left + window.scrollX),
  };
}
