import type Highlight from '../forum/models/Highlight';

declare module 'flarum/common/models/Post' {
  export default interface Post {
    /** Registered by the Extend.Model extender in forum/extend.ts. */
    marginaliaHighlights(): (Highlight | undefined)[] | false;
  }
}
