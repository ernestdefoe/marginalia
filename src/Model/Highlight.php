<?php

namespace ErnestDefoe\Marginalia\Model;

use Flarum\Database\AbstractModel;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One marked passage in one post.
 *
 * A highlight is an ANCHOR, not a copy: it stores where the passage was and
 * enough of its text to find it again, and the post remains the only source of
 * what it says. An edit can move a passage or delete it outright, and a
 * highlight that can no longer be found is simply not drawn.
 *
 * @property int $id
 * @property int $post_id
 * @property int $user_id
 * @property bool $is_public
 * @property string|null $note
 * @property int $start
 * @property int $length
 * @property string $quoted
 * @property string|null $prefix
 * @property string|null $suffix
 */
class Highlight extends AbstractModel
{
    protected $table = 'marginalia_highlights';

    protected $casts = [
        'is_public' => 'bool',
        'start' => 'int',
        'length' => 'int',
    ];

    protected $fillable = ['is_public', 'note', 'start', 'length', 'quoted', 'prefix', 'suffix'];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class, 'post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * 🚨 The whole privacy model, in one scope.
     *
     * Public marks are everyone's; a private mark belongs to its author and to
     * nobody else — not to moderators, not to admins. It is a reading aid, and
     * a reading aid somebody else can look at is a surveillance feature.
     *
     * Posts the actor cannot see are excluded too: a highlight is a quotation
     * of its post, so it must not outlive that post's visibility.
     */
    public function scopeWhereVisibleTo(Builder $query, User $actor): Builder
    {
        return $query
            ->where(function (Builder $q) use ($actor) {
                $q->where('is_public', true);

                if ($actor->exists) {
                    $q->orWhere('user_id', $actor->id);
                }
            })
            // 🚨 Through the relation, not a raw `from('posts')`: this forum
            // may run a table prefix, raw SQL is passed through verbatim, and
            // core's own visibility scope is the only correct answer to "can
            // this actor see that post" anyway.
            ->whereHas('post', function ($q) use ($actor) {
                $q->whereVisibleTo($actor);
            });
    }
}
