import app from 'flarum/forum/app';

import { locate, plainText, rangeFor } from './anchor';
import { highlightsFor } from '../state';
import { isMine } from './mine';

/**
 * Draw the marks on one rendered post.
 *
 * 🚨 Everything here has to be idempotent and reversible: `onupdate` runs on
 * every redraw, and the post body is server-rendered HTML that Mithril will
 * happily leave alone between renders. So each pass strips what the last pass
 * drew before drawing again — otherwise a mark inside a mark inside a mark,
 * and offsets computed from a body full of our own wrappers.
 */
const MARK = 'Marginalia-mark';

export function paint(element, post) {
  if (!element || !post) return;

  const body = element.querySelector('.Post-body');

  if (!body) return;

  // So a click or a selection anywhere inside this post can name it without
  // depending on core's markup.
  element.dataset.marginaliaPost = post.id();

  unpaint(body);

  const highlights = highlightsFor(post);

  if (!highlights.length) return;

  const text = plainText(body);
  const actor = app.session.user;

  // Resolve every mark to where it is NOW, dropping any whose passage has been
  // edited away. A mark that cannot be found is not guessed at.
  const placed = [];

  highlights.forEach((highlight) => {
    const at = locate(text, {
      start: highlight.start(),
      quoted: highlight.quoted(),
      prefix: highlight.prefix(),
      suffix: highlight.suffix(),
    });

    if (at) placed.push({ highlight, ...at });
  });

  if (!placed.length) return;

  /*
   * Heat: how many people marked each character.
   *
   * Drawn as a sweep over boundaries rather than by nesting the marks, because
   * marks overlap freely — two readers rarely select exactly the same words,
   * and three nested spans would give the middle of a sentence three
   * backgrounds and three click targets.
   */
  const boundaries = new Set([0, text.length]);

  placed.forEach(({ start, length }) => {
    boundaries.add(start);
    boundaries.add(start + length);
  });

  const points = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];

    if (to <= from) continue;

    const covering = placed.filter((p) => p.start < to && p.start + p.length > from);

    if (!covering.length) continue;

    const publicCount = covering.filter((c) => c.highlight.isPublic()).length;
    const mine = actor && covering.some((c) => isMine(c.highlight));

    segments.push({ from, to, covering, publicCount, mine });
  }

  // 🚨 Applied back to front. Wrapping text in a span splits the text node it
  // was in, which invalidates every offset after it — going backwards means
  // each wrap only disturbs text the loop has already dealt with.
  segments.reverse().forEach((segment) => {
    const range = rangeFor(body, segment.from, segment.to - segment.from);

    if (!range) return;

    const span = document.createElement('span');

    span.className = MARK;
    span.dataset.marginaliaPublic = String(segment.publicCount);
    span.dataset.marginaliaIds = segment.covering.map((c) => c.highlight.id()).join(',');

    if (segment.mine) span.dataset.marginaliaMine = 'true';

    // Four steps is as much as a background tint can say before it stops
    // meaning anything. Past three marks it is simply "a lot of people".
    span.dataset.marginaliaHeat = String(Math.min(segment.publicCount, 4));

    try {
      range.surroundContents(span);
    } catch (e) {
      // A selection crossing an element boundary (half a sentence and half a
      // link) cannot be wrapped in one span. Skipping that segment loses a
      // little colour; splitting it by hand loses the reader's place.
    }
  });
}

export function unpaint(body) {
  body.querySelectorAll('.' + MARK).forEach((span) => {
    const parent = span.parentNode;

    while (span.firstChild) parent.insertBefore(span.firstChild, span);

    parent.removeChild(span);
    parent.normalize(); // or the text nodes stay split and offsets drift
  });
}
