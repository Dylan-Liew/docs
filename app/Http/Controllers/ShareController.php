<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\GetPathFromVaultNode;
use App\Actions\GetVaultNodeFromPath;
use App\Actions\ResolveTwoPaths;
use App\Events\VaultUpdatedEvent;
use App\Models\User;
use App\Models\Vault;
use App\Models\VaultNode;
use App\Services\VaultFiles\Types\Note;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final readonly class ShareController
{
    private const HEADERS = [
        'Cache-Control' => 'private, no-store, max-age=0',
        'X-Robots-Tag' => 'noindex, nofollow',
        'Referrer-Policy' => 'no-referrer',
        'X-Content-Type-Options' => 'nosniff',
    ];

    public function store(Vault $vault, #[CurrentUser] User $user): JsonResponse
    {
        abort_unless($user->can('update', $vault), 403);
        // Conditional update makes repeated/concurrent creation return the same link.
        Vault::whereKey($vault->id)->whereNull('share_token')->update(['share_token' => bin2hex(random_bytes(32))]);
        $vault->refresh();
        broadcast(new VaultUpdatedEvent($vault))->toOthers();

        return response()->json(['data' => ['share_url' => $vault->shareUrl()]], headers: self::HEADERS);
    }

    public function destroy(Vault $vault, #[CurrentUser] User $user): JsonResponse
    {
        abort_unless($user->can('update', $vault), 403);
        $vault->update(['share_token' => null]);
        broadcast(new VaultUpdatedEvent($vault))->toOthers();

        return response()->json(['data' => ['share_url' => null]], headers: self::HEADERS);
    }

    public function show(Request $request, string $token): Response|JsonResponse
    {
        $vault = Vault::where('share_token', $token)->first();
        if ($vault === null) return $this->page($request, ['error' => 'This link is no longer available.'], 404);

        $query = validator($request->query(), [
            'file' => ['nullable', 'integer', 'min:1'],
            'path' => ['nullable', 'string', 'max:4096'],
        ]);
        if ($query->fails()) return $this->page($request, ['error' => 'This note is no longer available.'], 404);
        $query = $query->validated();
        $base = '/share/' . $token;
        $node = isset($query['file'])
            ? $vault->nodes()->where('is_file', true)->find($query['file'])
            : null;
        if (isset($query['file']) && $node === null) return $this->page($request, ['error' => 'This note is no longer available.'], 404);
        if (isset($query['path'])) {
            $path = app(ResolveTwoPaths::class)->handle($node ? '/' . $node->fullPath() . '.' . $node->extension : '/', $query['path']);
            $node = app(GetVaultNodeFromPath::class)->handle($vault->id, $path);
            if ($node === null) return $this->page($request, ['error' => 'This note is no longer available.'], 404);
        }

        $selected = $node ? [
            'id' => $node->id,
            'name' => $node->name,
            'type' => $node->type()->value,
            'content' => $node->type()->value === 'note'
                ? ($node->content ?? Storage::disk('local')->get(app(GetPathFromVaultNode::class)->handle($node)))
                : null,
            'url' => $base . '/files?node=' . $node->id,
        ] : null;
        $nodes = $vault->nodes()->orderByRaw('LOWER(name)')->orderBy('id')->get(['id', 'parent_id', 'name', 'extension', 'is_file'])
            ->map(fn (VaultNode $item) => [
                'id' => $item->id,
                'parent_id' => $item->parent_id,
                'name' => $item->name,
                'type' => $item->type()->value,
                'is_file' => $item->is_file,
            ]);

        return $this->page($request, ['base' => $base, 'name' => $vault->name, 'nodes' => $nodes, 'selected' => $selected]);
    }

    public function files(Request $request, string $token): BinaryFileResponse
    {
        $vault = Vault::where('share_token', $token)->firstOrFail();
        $query = validator($request->query(), [
            'node' => ['nullable', 'integer', 'min:1'],
            'path' => ['nullable', 'string', 'max:4096'],
        ]);
        abort_unless($query->passes(), 404);
        $query = $query->validated();
        $node = isset($query['node']) ? $vault->nodes()->findOrFail($query['node']) : null;
        if (isset($query['path'])) {
            $path = app(ResolveTwoPaths::class)->handle($node ? '/' . $node->fullPath() . '.' . $node->extension : '/', $query['path']);
            $node = app(GetVaultNodeFromPath::class)->handle($vault->id, $path);
        }
        abort_unless($node instanceof VaultNode && $node->is_file && !in_array($node->extension, Note::extensions()), 404);
        $path = app(GetPathFromVaultNode::class)->handle($node);
        abort_unless(Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), self::HEADERS);
    }

    private function page(Request $request, array $data, int $status = 200): Response|JsonResponse
    {
        if ($request->expectsJson()) return response()->json($data, $status, self::HEADERS);

        return response()->view('share', ['data' => $data], $status, self::HEADERS);
    }
}
