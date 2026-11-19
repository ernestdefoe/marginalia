import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import RequestError from 'flarum/common/utils/RequestError';
import type Post from 'flarum/common/models/Post';

import { remember, forget, highlightsFor, repaint } from '../state';
import { isMine } from '../utils/mine';
import type Highlight from '../models/Highlight';
import type { Description } from '../utils/anchor';

interface At {
  top: number;
  left: number;
}

interface LayerState {
  mode: 'toolbar' | 'popup' | null;
  post: Post | null;
  at: At | null;
  selection: Description | null;
  ids: string[];
  busy: boolean;
  note: string;
  highlight: Highlight | null;
}

/**
 * The two floating things: the bar that appears over a selection, and the card
 * that appears when a mark is clicked.
 *
 * Both live in one component mounted once on `document.body`, rather than
 * inside the post they belong to. A post's body is server-rendered HTML that
 * gets re-written on every redraw, and anything rendered into it would take
 * the reader's selection down with it the moment they made one.
 */
let state: LayerState = { mode: null, post: null, at: null, selection: null, ids: [], busy: false, note: '', highlight: null };

export function showToolbar(post: Post, selection: Description, at: At): void {
  state = { ...state, mode: 'toolbar', post, selection, at, busy: false };
  m.redraw();
}

export function showPopup(post: Post, ids: string[], at: At | null): void {
  const mine = highlightsFor(post).find((h) => ids.includes(String(h.id())) && isMine(h));

  state = { ...state, mode: 'popup', post, ids, at, highlight: mine || null, note: mine?.note() || '', busy: false };
  m.redraw();
}

export function dismiss(): void {
  if (!state.mode) return;

  state = { ...state, mode: null, selection: null, ids: [], highlight: null };
  m.redraw();
}

export default class Layer extends Component {
  view() {
    if (!state.mode) return <div className="Marginalia-layer" />;

    const style = { top: `${state.at?.top ?? 0}px`, left: `${state.at?.left ?? 0}px` };

    return (
      <div className="Marginalia-layer Marginalia-chrome">
        <div className={`Marginalia-float Marginalia-float--${state.mode}`} style={style} data-marginalia-ids={(state.ids || []).join(',')}>
          {state.mode === 'toolbar' ? this.toolbar() : this.popup()}
        </div>
      </div>
    );
  }

  toolbar() {
    if (state.busy) return <LoadingIndicator display="inline" size="small" />;

    // 🚨 Not `Button--icon`: that class is core's icon-ONLY button and it
    // hides the label, so both actions rendered as bare glyphs with no words.
    return [
      <Button className="Button Marginalia-action" icon="fas fa-highlighter" onclick={() => this.create(true)}>
        {app.translator.trans('ernestdefoe-marginalia.forum.toolbar.highlight')}
      </Button>,
      <Button className="Button Marginalia-action" icon="fas fa-note-sticky" onclick={() => this.create(false)}>
        {app.translator.trans('ernestdefoe-marginalia.forum.toolbar.note')}
      </Button>,
    ];
  }

  popup() {
    const all = highlightsFor(state.post).filter((h) => state.ids.includes(String(h.id())));
    const publicOnes = all.filter((h) => h.isPublic());
    const others = publicOnes.filter((h) => !isMine(h));
    const mine = state.highlight;

    return (
      <div className="Marginalia-card">
        <div className="Marginalia-card-heat">
          {publicOnes.length
            ? app.translator.trans('ernestdefoe-marginalia.forum.popup.marked_by', {
                count: publicOnes.length,
                names: others
                  .slice(0, 3)
                  .map((h) => username(h.user() || null))
                  .join(', '),
              })
            : app.translator.trans('ernestdefoe-marginalia.forum.popup.private_only')}
        </div>

        {mine ? (
          <div className="Marginalia-card-note">
            <textarea
              className="FormControl"
              rows={3}
              placeholder={app.translator.trans('ernestdefoe-marginalia.forum.popup.note_placeholder')}
              value={state.note}
              oninput={(e: InputEvent) => {
                state.note = (e.target as HTMLTextAreaElement).value;
              }}
            />
            <div className="Marginalia-card-actions">
              <Button className="Button Button--primary Button--small" loading={state.busy} onclick={() => this.saveNote()}>
                {app.translator.trans('ernestdefoe-marginalia.forum.popup.save')}
              </Button>
              <Button className="Button Button--link Button--small" onclick={() => this.toggleVisibility()}>
                {mine.isPublic()
                  ? app.translator.trans('ernestdefoe-marginalia.forum.popup.make_private')
                  : app.translator.trans('ernestdefoe-marginalia.forum.popup.make_public')}
              </Button>
              <Button className="Button Button--link Button--small Marginalia-remove" onclick={() => this.remove()}>
                {app.translator.trans('ernestdefoe-marginalia.forum.popup.remove')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  async create(isPublic: boolean): Promise<void> {
    const { post, selection } = state;

    if (!post || !selection) return;

    state.busy = true;
    m.redraw();

    try {
      /*
       * 🚨 Keep what save() RESOLVES WITH, not the record it was called on.
       *
       * Flarum pushes the response through the store, and the store hands back
       * its own instance — the local record stays id-less. Holding on to it
       * poisoned three things at once, none of which pointed at the cause:
       * the new mark drew with no id, a second mark was deduplicated away
       * against the first (both stringified to "undefined"), and the popup
       * opened on the wrong highlight entirely.
       */
      const highlight = app.store.createRecord<Highlight>('marginalia-highlights');

      const created =
        (await highlight.save({
          ...selection,
          isPublic,
          note: '',
          relationships: { post },
        })) || highlight;

      remember(post, created);

      // A private mark exists to carry a note, so go straight to writing one.
      if (isPublic) {
        dismiss();
      } else {
        showPopup(post, [String(created.id())], state.at);
      }

      window.getSelection()?.removeAllRanges();
    } catch (error) {
      failed(error);
    }

    m.redraw();
  }

  async saveNote(): Promise<void> {
    if (!state.highlight) return;

    state.busy = true;
    m.redraw();

    try {
      await state.highlight.save({ note: state.note });
      dismiss();
    } catch (error) {
      failed(error);
    }

    m.redraw();
  }

  async toggleVisibility(): Promise<void> {
    if (!state.highlight) return;

    const next = !state.highlight.isPublic();

    state.busy = true;
    m.redraw();

    try {
      await state.highlight.save({ isPublic: next });
      state.busy = false;

      // The heat counts public marks only, so the post's colour changes too.
      if (state.post) repaint(state.post);
    } catch (error) {
      failed(error);
    }

    m.redraw();
  }

  async remove(): Promise<void> {
    if (!state.highlight) return;

    state.busy = true;
    m.redraw();

    try {
      await state.highlight.delete();

      if (state.post) forget(state.post, state.highlight);
      dismiss();
    } catch (error) {
      failed(error);
    }

    m.redraw();
  }
}

/**
 * Every failed save ends here, so none of them leaves the reader guessing.
 *
 * A failed request has already been announced: core's request error handler
 * shows the server's own message (a note over the length limit, a mark that
 * was removed elsewhere), and a second, vaguer alert on top of it would only
 * add noise. Anything else (the request never went out, or handling its
 * response threw) gets this extension's alert instead.
 */
function failed(error: unknown): void {
  state.busy = false;

  if (!(error instanceof RequestError)) {
    app.alerts.show({ type: 'error' }, app.translator.trans('ernestdefoe-marginalia.forum.error'));
  }
}
