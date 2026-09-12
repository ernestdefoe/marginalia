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

    (new Extend\ApiResource(HighlightResource::class)),

    // 🚨 Default-included only where the post's BODY is rendered. The
    // discussion list never draws a post body, so including marks there would
    // serialise them for two posts per row to paint nothing.
    (new Extend\ApiResource(Resource\PostResource::class))
        ->fields(PostResourceFields::class)
        ->endpoint(
            [Endpoint\Index::class, Endpoint\Show::class, Endpoint\Create::class, Endpoint\Update::class],
            fn (Endpoint\Endpoint $endpoint) => $endpoint->addDefaultInclude(['marginaliaHighlights'])
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
