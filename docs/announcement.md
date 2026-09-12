# Marginalia — highlight a passage, privately or publicly (Built using AI)

People read threads with a pen in their hand, metaphorically. They find the sentence that actually answers the question, the one line in a long post that changes the decision — and then they have nowhere to put that, except a reply that says "this".

Marginalia gives them somewhere to put it.

Select any passage in a post and you get two actions: **Highlight** it publicly, or keep it to yourself as a **Note**.

![The selection toolbar](https://raw.githubusercontent.com/ernestdefoe/marginalia/main/screenshots/toolbar.png)

## Public marks aggregate

One reader's mark is a faint tint. A stretch that three readers all marked is unmistakable. Nobody curates anything and nobody votes — the thread simply shows which sentences landed.

![A sentence three readers marked, and one private mark](https://raw.githubusercontent.com/ernestdefoe/marginalia/main/screenshots/heat.png)

The dotted rule on the left of that shot is a private mark. It is drawn differently on purpose: it is not heat, it is a bookmark, and only its author can see it at all.

Click a mark to see how many people marked it, write the note only you can read, change your mind about it being public, or take it back:

![The mark popup](https://raw.githubusercontent.com/ernestdefoe/marginalia/main/screenshots/popup.png)

## The privacy model, which is the point

- **A private mark is its author's and nobody else's** — not moderators', not admins'. A reading aid other people can inspect is a surveillance feature.
- **The note is always private, whether or not the mark is public.** Publishing a mark says *where somebody looked*. It never publishes what they wrote about it — which is also what keeps this out of the moderation queue that a second public text channel would create.
- Both are enforced on the server twice over: the model scope decides what can be queried at all, and the post relationship decides what is serialised.

## How a mark survives an edit

A highlight is an **anchor**, not a copy: an offset into the post's plain text, the passage itself, and forty characters of context either side. None of the post's words are duplicated anywhere.

When the post is drawn, the passage is found again — at its old offset first, then by its context, then by the nearest identical run of text. A passage that has been edited away is **not drawn**, because the alternative is putting somebody's mark on words they never marked.

Marks travel with the post as an API relationship rather than a second request, so they are painted on the first render instead of appearing a beat later.

## Permissions

- `marginalia.highlight` — mark a passage. Members, by default.
- `marginalia.moderate` — remove someone else's **public** mark. Moderators.

Private marks are nobody's to remove but their author's.

## Install

```
composer require ernestdefoe/marginalia
```

- **GitHub:** https://github.com/ernestdefoe/marginalia
- **Packagist:** https://packagist.org/packages/ernestdefoe/marginalia
- **Support:** https://ernestdefoe.online/d/94
- **Licence:** MIT

Bug reports and ideas welcome — particularly about the anchoring, which is where a highlighting tool lives or dies.
