<?php

namespace ErnestDefoe\Marginalia\Access;

use ErnestDefoe\Marginalia\Model\Highlight;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;

class HighlightPolicy extends AbstractPolicy
{
    /**
     * A mark is its author's. Nobody edits somebody else's note or visibility.
     */
    public function edit(User $actor, Highlight $highlight): ?string
    {
        return $actor->id === $highlight->user_id ? $this->allow() : $this->deny();
    }

    /**
     * The author always; a moderator only for PUBLIC marks — a private one is
     * not theirs to touch, and there is nothing public to moderate in it.
     */
    public function delete(User $actor, Highlight $highlight): ?string
    {
        if ($actor->id === $highlight->user_id) {
            return $this->allow();
        }

        if ($highlight->is_public && $actor->hasPermission('marginalia.moderate')) {
            return $this->allow();
        }

        return $this->deny();
    }
}
