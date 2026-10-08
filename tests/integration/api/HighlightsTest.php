<?php

namespace ErnestDefoe\Marginalia\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Group\Group;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

class HighlightsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-marginalia');

        $posts = [];
        for ($n = 1; $n <= 8; $n++) {
            $posts[] = ['id' => $n, 'discussion_id' => 1, 'number' => $n, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Post '.$n.'</p></t>'];
        }
        // A post nobody here can read: core hides private discussions.
        $posts[] = ['id' => 20, 'discussion_id' => 2, 'number' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Secret</p></t>', 'is_private' => 1];

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'other', 'email' => 'other@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'moderator', 'email' => 'mod@machine.local', 'is_email_confirmed' => 1],
            ],
            'group_user' => [
                ['user_id' => 4, 'group_id' => Group::MODERATOR_ID],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Open', 'created_at' => Carbon::now(), 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 8],
                ['id' => 2, 'title' => 'Private', 'created_at' => Carbon::now(), 'user_id' => 2, 'first_post_id' => 20, 'comment_count' => 1, 'is_private' => 1],
            ],
            Post::class => $posts,
            'marginalia_highlights' => [
                ['id' => 1, 'post_id' => 1, 'user_id' => 3, 'is_public' => 1, 'note' => 'what 3 thinks', 'start' => 0, 'length' => 4, 'quoted' => 'Post'],
                ['id' => 2, 'post_id' => 1, 'user_id' => 3, 'is_public' => 0, 'note' => null, 'start' => 0, 'length' => 4, 'quoted' => 'Post'],
                ['id' => 3, 'post_id' => 1, 'user_id' => 2, 'is_public' => 0, 'note' => 'mine', 'start' => 0, 'length' => 4, 'quoted' => 'Post'],
                // Made before the discussion went private: its author can no
                // longer read the post, so the mark must not be reachable.
                ['id' => 4, 'post_id' => 20, 'user_id' => 2, 'is_public' => 1, 'note' => null, 'start' => 0, 'length' => 6, 'quoted' => 'Secret'],
            ],
        ]);
    }

    private function create(int $actor, int $post): \Psr\Http\Message\ResponseInterface
    {
        return $this->send($this->request('POST', '/api/marginalia-highlights', [
            'authenticatedAs' => $actor,
            'json' => ['data' => [
                'type' => 'marginalia-highlights',
                'attributes' => ['quoted' => 'Post', 'start' => 0, 'length' => 4, 'isPublic' => false],
                'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => (string) $post]]],
            ]],
        ]));
    }

    private function patch(int $actor, int $id, array $attributes): \Psr\Http\Message\ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/marginalia-highlights/$id", [
            'authenticatedAs' => $actor,
            'json' => ['data' => ['type' => 'marginalia-highlights', 'id' => (string) $id, 'attributes' => $attributes]],
        ]));
    }

    private function delete(int $actor, int $id): int
    {
        return $this->send($this->request('DELETE', "/api/marginalia-highlights/$id", ['authenticatedAs' => $actor]))->getStatusCode();
    }

    /** @return array<int, array> the post's included highlights, keyed by id */
    private function marksOnPost(?int $actor, int $post): array
    {
        $response = $this->send($this->request('GET', "/api/posts/$post", $actor ? ['authenticatedAs' => $actor] : []));
        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);

        $ids = array_column($body['data']['relationships']['marginaliaHighlights']['data'], 'id');
        $included = array_column(array_filter($body['included'] ?? [], fn ($r) => $r['type'] === 'marginalia-highlights'), null, 'id');

        $marks = [];
        foreach ($ids as $id) {
            $marks[(int) $id] = $included[$id]['attributes'];
        }
        ksort($marks);

        return $marks;
    }

    #[Test]
    public function a_member_marks_a_passage_as_themself()
    {
        $response = $this->create(2, 1);

        $this->assertSame(201, $response->getStatusCode(), (string) $response->getBody());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertSame('2', $body['data']['relationships']['user']['data']['id'] ?? null);
        $this->assertFalse($body['data']['attributes']['isPublic']);
        $this->assertSame(2, $this->database()->table('marginalia_highlights')->where('id', $body['data']['id'])->value('user_id'));
    }

    #[Test]
    public function a_member_without_the_permission_cannot_mark()
    {
        $this->app();
        $this->database()->table('group_permission')->where('permission', 'marginalia.highlight')->delete();

        $this->assertSame(403, $this->create(2, 1)->getStatusCode());
    }

    #[Test]
    public function a_private_mark_is_seen_by_its_author_alone()
    {
        $this->assertSame([1, 3], array_keys($this->marksOnPost(2, 1)), 'Public marks plus your own private ones');
        $this->assertSame([1, 2], array_keys($this->marksOnPost(3, 1)));
        $this->assertSame([1], array_keys($this->marksOnPost(4, 1)), 'Not even a moderator sees a private mark');
        $this->assertSame([1], array_keys($this->marksOnPost(null, 1)));
    }

    #[Test]
    public function a_note_is_read_by_its_author_alone_even_on_a_public_mark()
    {
        $this->assertSame('what 3 thinks', $this->marksOnPost(3, 1)[1]['note'] ?? null);
        $this->assertArrayNotHasKey('note', $this->marksOnPost(2, 1)[1]);
        $this->assertArrayNotHasKey('note', $this->marksOnPost(null, 1)[1]);
        $this->assertSame('mine', $this->marksOnPost(2, 1)[3]['note'] ?? null);
    }

    #[Test]
    public function only_the_author_edits_a_mark()
    {
        $this->assertSame(403, $this->patch(2, 1, ['note' => 'hijacked'])->getStatusCode(), 'Someone else\'s public mark');
        $this->assertSame(404, $this->patch(2, 2, ['note' => 'hijacked'])->getStatusCode(), 'Someone else\'s private mark does not exist for you');

        $response = $this->patch(3, 1, ['note' => 'changed my mind', 'isPublic' => false]);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('changed my mind', $this->database()->table('marginalia_highlights')->where('id', 1)->value('note'));
    }

    #[Test]
    public function a_mark_on_a_post_its_author_can_no_longer_read_is_out_of_reach()
    {
        $this->assertSame(404, $this->patch(2, 4, ['note' => 'x'])->getStatusCode());
    }

    #[Test]
    public function a_moderator_clears_public_marks_but_never_private_ones()
    {
        $this->assertSame(403, $this->delete(2, 1), 'A member cannot clear somebody else\'s mark');
        $this->assertSame(404, $this->delete(4, 2), 'A private mark is nobody else\'s to touch');
        $this->assertSame(204, $this->delete(4, 1));
        $this->assertSame(204, $this->delete(2, 3), 'An author clears their own private mark');

        $this->assertSame([2], $this->database()->table('marginalia_highlights')->whereIn('id', [1, 2, 3])->pluck('id')->all());
    }

    #[Test]
    public function the_forum_says_whether_the_reader_may_mark()
    {
        $guest = json_decode((string) $this->send($this->request('GET', '/api'))->getBody(), true);
        $member = json_decode((string) $this->send($this->request('GET', '/api', ['authenticatedAs' => 2]))->getBody(), true);

        $this->assertFalse($guest['data']['attributes']['canMarginaliaHighlight']);
        $this->assertTrue($member['data']['attributes']['canMarginaliaHighlight']);
    }

    #[Test]
    public function marks_on_a_page_of_posts_load_in_one_query()
    {
        $this->app();
        $rows = [];
        for ($post = 2; $post <= 8; $post++) {
            $rows[] = ['post_id' => $post, 'user_id' => 3, 'is_public' => 1, 'start' => 0, 'length' => 4, 'quoted' => 'Post'];
        }
        $this->database()->table('marginalia_highlights')->insert($rows);

        // The repeated-query detector fails the request on an N+1.
        $response = $this->send($this->request('GET', '/api/posts', ['authenticatedAs' => 2])->withQueryParams(['filter' => ['discussion' => 1]]));

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertCount(8, $body['data']);
        $this->assertCount(9, array_filter($body['included'], fn ($r) => $r['type'] === 'marginalia-highlights'));
    }

    #[Test]
    public function marks_on_first_posts_in_a_discussion_list_load_in_one_query()
    {
        $this->app();
        $discussions = [];
        $posts = [];
        $marks = [];
        for ($d = 10; $d <= 17; $d++) {
            $discussions[] = ['id' => $d, 'title' => "D$d", 'slug' => "d$d", 'created_at' => Carbon::now(), 'user_id' => 2, 'comment_count' => 1];
            $posts[] = ['id' => $d * 10, 'discussion_id' => $d, 'number' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Post</p></t>'];
            $marks[] = ['post_id' => $d * 10, 'user_id' => 3, 'is_public' => 1, 'start' => 0, 'length' => 4, 'quoted' => 'Post'];
        }
        // Discussions, then their posts, then the link back: the first_post_id
        // foreign key needs the post to exist.
        $this->database()->table('discussions')->insert($discussions);
        $this->database()->table('posts')->insert($posts);
        for ($d = 10; $d <= 17; $d++) {
            $this->database()->table('discussions')->where('id', $d)->update(['first_post_id' => $d * 10]);
        }
        $this->database()->table('marginalia_highlights')->insert($marks);

        $response = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2])->withQueryParams(['include' => 'firstPost.marginaliaHighlights']));

        $this->assertSame(200, $response->getStatusCode(), (string) $response->getBody());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertCount(10, array_filter($body['included'], fn ($r) => $r['type'] === 'marginalia-highlights'), '8 new marks, plus a public and an own private one on discussion 1');
    }
}
