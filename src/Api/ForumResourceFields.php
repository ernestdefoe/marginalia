<?php

namespace ErnestDefoe\Marginalia\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;

/**
 * The frontend has to know whether this reader may mark anything at all, or
 * the toolbar appears for guests and then fails on save.
 */
class ForumResourceFields
{
    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canMarginaliaHighlight')
                ->get(fn ($forum, Context $context) => $context->getActor()->hasPermission('marginalia.highlight')),
        ];
    }
}
