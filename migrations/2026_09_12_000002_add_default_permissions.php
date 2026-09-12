<?php

use Flarum\Database\Migration;
use Flarum\Group\Group;

/*
 * 🚨 The value is a GROUP ID, not a group name. `'member'` is silently
 * accepted and inserts nothing — the migration records itself as run, the
 * permission never exists, and the feature is simply off for everybody with
 * no error anywhere.
 */
return Migration::addPermissions([
    // Anyone who can post can mark a passage. A private mark is a reading aid,
    // and a public one is a weaker action than replying.
    'marginalia.highlight' => Group::MEMBER_ID,

    // Clearing somebody else's PUBLIC mark. Private marks are nobody's to
    // touch, moderators included — see the model.
    'marginalia.moderate' => Group::MODERATOR_ID,
]);
