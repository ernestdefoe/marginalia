<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('marginalia_highlights')) {
            return;
        }

        $schema->create('marginalia_highlights', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('user_id');

            // Public marks aggregate into the heat everyone sees. A private one
            // is visible to its author and to nobody else, ever.
            $table->boolean('is_public')->default(true);

            // 🚨 The note is the author's, whether or not the MARK is public.
            // Publishing a mark shares where somebody looked, never what they
            // wrote about it — that keeps this feature out of the moderation
            // queue, which a second public text channel would land it in.
            $table->text('note')->nullable();

            // Where the passage was, in the post's plain text, when it was
            // marked — plus enough of the passage itself to find it again after
            // the post is edited. Offsets alone are worthless the moment
            // somebody fixes a typo three paragraphs above.
            $table->unsignedInteger('start')->default(0);
            $table->unsignedInteger('length')->default(0);
            $table->text('quoted');
            $table->string('prefix', 100)->nullable();
            $table->string('suffix', 100)->nullable();

            $table->timestamps();

            $table->index('post_id');
            $table->index(['post_id', 'is_public'], 'marginalia_post_public');
            $table->index(['user_id', 'post_id'], 'marginalia_user_post');

            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    },

    'down' => function (Builder $schema) {
        $schema->dropIfExists('marginalia_highlights');
    },
];
