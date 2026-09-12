import Model from 'flarum/common/Model';

/**
 * One marked passage, client side.
 *
 * 🚨 `note` is not always present: the API serialises it for its author only,
 * so on somebody else's public mark the attribute is simply absent rather than
 * empty. Anything reading it has to treat undefined as "not mine to see".
 */
export default class Highlight extends Model {
  static isPublic = Model.attribute('isPublic');
  static note = Model.attribute('note');
  static start = Model.attribute('start');
  static length = Model.attribute('length');
  static quoted = Model.attribute('quoted');
  static prefix = Model.attribute('prefix');
  static suffix = Model.attribute('suffix');
  static createdAt = Model.attribute('createdAt', Model.transformDate);

  static user = Model.hasOne('user');
  static post = Model.hasOne('post');
}

Object.assign(Highlight.prototype, {
  isPublic: Highlight.isPublic,
  note: Highlight.note,
  start: Highlight.start,
  length: Highlight.length,
  quoted: Highlight.quoted,
  prefix: Highlight.prefix,
  suffix: Highlight.suffix,
  createdAt: Highlight.createdAt,
  user: Highlight.user,
  post: Highlight.post,
});
