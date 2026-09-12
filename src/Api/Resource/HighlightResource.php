<?php

namespace ErnestDefoe\Marginalia\Api\Resource;

use ErnestDefoe\Marginalia\Model\Highlight;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Post\Post;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Tobyz\JsonApiServer\Context as BaseContext;
use Tobyz\JsonApiServer\Exception\BadRequestException;

class HighlightResource extends AbstractDatabaseResource
{
    public function type(): string
    {
        return 'marginalia-highlights';
    }

    public function model(): string
    {
        return Highlight::class;
    }

    public function scope(Builder $query, BaseContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    public function endpoints(): array
    {
        return [
            // 🚨 No Index endpoint on purpose. Marks are carried by the post
            // they are on (see Api\PostResourceFields), and Flarum 2 has no
            // JSON:API filters — `filter[post]=` would mean registering a
            // model searcher to answer a question the post stream already
            // answers. What is left here is the three writes.
            Endpoint\Create::make()
                ->authenticated()
                ->can('marginalia.highlight'),

            // Only the author edits a mark, and only its note and its
            // visibility — the anchor is a record of what was marked and when,
            // not a field.
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit'),

            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete'),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Boolean::make('isPublic')
                ->property('is_public')
                ->writable()
                ->default(true),

            // 🚨 Readable by its author and by nobody else, whether or not the
            // MARK is public. Publishing a mark says where somebody looked; it
            // never publishes what they wrote about it.
            Schema\Str::make('note')
                ->nullable()
                ->writable()
                ->visible(fn (Highlight $h, Context $context) => $context->getActor()->id === $h->user_id)
                ->maxLength(2000),

            Schema\Integer::make('start')
                ->writableOnCreate()
                ->default(0),

            Schema\Integer::make('length')
                ->writableOnCreate()
                ->default(0),

            Schema\Str::make('quoted')
                ->writableOnCreate()
                ->required()
                ->maxLength(2000),

            Schema\Str::make('prefix')
                ->nullable()
                ->writableOnCreate()
                ->maxLength(100),

            Schema\Str::make('suffix')
                ->nullable()
                ->writableOnCreate()
                ->maxLength(100),

            Schema\DateTime::make('createdAt')
                ->property('created_at'),

            Schema\Relationship\ToOne::make('user')
                ->type('users')
                ->includable(),

            Schema\Relationship\ToOne::make('post')
                ->type('posts')
                ->writableOnCreate()
                ->required(),
        ];
    }

    /**
     * 🚨 The parameter is the json-api-server Context, not Flarum's.
     * AbstractResource declares it that way, and PHP rejects the narrower
     * hint outright — a fatal at class-load time, which on boot means the
     * whole forum 500s rather than just this extension misbehaving. The
     * object passed in IS Flarum's Context, so its helpers still work.
     */
    public function creating(object $model, BaseContext $context): ?object
    {
        $model->user_id = $context->getActor()->id;

        // 🚨 The post has to be checked here, not trusted from the payload.
        // `post` is a writable relationship, so without this a member could
        // anchor a highlight to a post in a private tag they cannot read and
        // then read its text back out of their own highlight.
        $post = Post::query()
            ->whereVisibleTo($context->getActor())
            ->find(Arr::get($context->body(), 'data.relationships.post.data.id'));

        if (! $post) {
            throw new BadRequestException('post');
        }

        $model->post_id = $post->id;

        return $model;
    }
}
