import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';

import Highlight from './models/Highlight';

/*
 * 🚨 Both halves are needed, and neither fails loudly without the other.
 * Without the store registration the payload's marks are dropped on arrival;
 * without the relationship `post.marginaliaHighlights` is simply not a
 * function, and the only symptom is that nothing is ever drawn.
 */
export default [new Extend.Store().add('marginalia-highlights', Highlight), new Extend.Model(Post).hasMany<Highlight>('marginaliaHighlights')];
