import Model from 'flarum/common/Model';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';

/**
 * One marked passage, client side.
 *
 * 🚨 `note` is not always present: the API serialises it for its author only,
 * so on somebody else's public mark the attribute is simply absent rather than
 * empty. Anything reading it has to treat undefined as "not mine to see".
 */
export default class Highlight extends Model {
  isPublic() {
    return Model.attribute<boolean>('isPublic').call(this);
  }

  note() {
    return Model.attribute<string | null | undefined>('note').call(this);
  }

  start() {
    return Model.attribute<number>('start').call(this);
  }

  length() {
    return Model.attribute<number>('length').call(this);
  }

  quoted() {
    return Model.attribute<string>('quoted').call(this);
  }

  prefix() {
    return Model.attribute<string | null>('prefix').call(this);
  }

  suffix() {
    return Model.attribute<string | null>('suffix').call(this);
  }

  createdAt() {
    return Model.attribute('createdAt', Model.transformDate).call(this);
  }

  user() {
    return Model.hasOne<User>('user').call(this);
  }

  post() {
    return Model.hasOne<Post>('post').call(this);
  }
}
