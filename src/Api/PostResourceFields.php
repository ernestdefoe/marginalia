<?php

namespace ErnestDefoe\Marginalia\Api;

use ErnestDefoe\Marginalia\Model\Highlight;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Post\Post;

/**
 * Marks travel with the post they are on.
 *
 * 🚨 A relationship, not a filterable endpoint. Flarum 2 replaced JSON:API
 * filters with model searchers, so `filter[post]=1,2,3` would mean registering
 * a searcher and a filter class to answer a question the post stream can
 * simply carry — and carrying it means the marks are painted on the first
 * render rather than after a second round trip.
 */
class PostResourceFields
{
    public function __invoke(): array
    {
        return [
            Schema\Relationship\ToMany::make('marginaliaHighlights')
                ->type('marginalia-highlights')
                ->includable()
                // 🚨 Filtered HERE, on the way out. The relation itself cannot
                // know who is asking, and a private mark is its author's alone
                // — moderators included. The note is separately owner-only in
                // HighlightResource, so a public mark never carries one out
                // either.
                ->get(function (Post $post, Context $context) {
                    $actor = $context->getActor();

                    return $post->marginaliaHighlights
                        ->filter(fn (Highlight $h) => $h->is_public || ($actor->exists && $h->user_id === $actor->id))
                        ->values()
                        ->all();
                }),
        ];
    }
}
