<?php

/*
 * Marginalia — highlight a passage in a post, privately or publicly.
 */

use ErnestDefoe\Marginalia\Access\HighlightPolicy;
use ErnestDefoe\Marginalia\Api\PostResourceFields;
use ErnestDefoe\Marginalia\Api\Resource\HighlightResource;
use ErnestDefoe\Marginalia\Model\Highlight;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Post\Post;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Model(Post::class))
        ->hasMany('marginaliaHighlights', Highlight::class, 'post_id'),

    new Extend\ApiResource(HighlightResource::class),

    // 🚨 Default-included only where the post's BODY is rendered. The
    // discussion list never draws a post body, so including marks there would
    // serialise them for two posts per row to paint nothing.
    (new Extend\ApiResource(Resource\PostResource::class))
        ->fields(PostResourceFields::class)
        ->endpoint(
            [Endpoint\Index::class, Endpoint\Show::class, Endpoint\Create::class, Endpoint\Update::class],
            fn (Endpoint\Index|Endpoint\Show|Endpoint\Create|Endpoint\Update $endpoint) => $endpoint
                ->addDefaultInclude(['marginaliaHighlights'])
                // 🚨 The include alone does NOT batch this. The field has a
                // custom getter (the privacy filter), which hides the relation
                // from Flarum's include compiler, so every post lazy loaded its
                // own marks: one query per post in the stream. Named here, it
                // is one query per page.
                ->eagerLoad(['marginaliaHighlights'])
        ),

    // Anywhere a client asks for marks on posts nested under a discussion
    // (`include=firstPost.marginaliaHighlights`, and so on), batch them too:
    // the same custom getter would otherwise lazy load once per row.
    (new Extend\ApiResource(Resource\DiscussionResource::class))
        ->endpoint(
            [Endpoint\Index::class, Endpoint\Show::class],
            fn (Endpoint\Endpoint $endpoint) => $endpoint->eagerLoad(
                fn (array $included) => array_values(array_filter(
                    $included,
                    fn ($path) => is_string($path) && str_ends_with($path, '.marginaliaHighlights')
                ))
            )
        ),

    // The frontend has to know whether this reader may mark anything at all,
    // or the toolbar appears for guests and then fails on save.
    (new Extend\ApiResource(Resource\ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canMarginaliaHighlight')
                ->get(fn ($forum, Context $context) => $context->getActor()->hasPermission('marginalia.highlight')),
        ]),

    (new Extend\Policy())
        ->modelPolicy(Highlight::class, HighlightPolicy::class),
];
