import app from 'flarum/forum/app';

/**
 * Is this mark the reader's own?
 *
 * 🚨 By id, never by object identity. `highlight.user() === app.session.user`
 * reads as obviously equivalent and is not: a record created in this session
 * carries a user relationship resolved at a different moment from the one the
 * session holds, and comparing the two silently said "not yours" about a mark
 * the reader had just made — so the note editor never opened on it.
 *
 * The fallback is the API's own privacy rule turned into a signal: `note` is
 * serialised for its author and nobody else, so an attribute that is present
 * at all — even empty — belongs to this reader.
 */
export function isMine(highlight) {
  if (!highlight) return false;

  const actor = app.session.user;

  if (!actor) return false;

  const owner = highlight.user?.();

  if (owner && String(owner.id()) === String(actor.id())) return true;

  return highlight.note?.() !== undefined;
}
