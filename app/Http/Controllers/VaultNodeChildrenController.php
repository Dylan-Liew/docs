<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Vault;
use App\Models\VaultNode;
use App\ViewModels\VaultNodeViewModel;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;

final readonly class VaultNodeChildrenController
{
    public function __invoke(Vault $vault, #[CurrentUser] User $user, ?VaultNode $node = null): JsonResponse
    {
        if ($user->cannot('view', $vault)) {
            abort(403);
        }

        $children = $vault->nodes()->where('parent_id', $node?->id)->withExists('childs')->orderBy('name')->get()
            ->map(fn(VaultNode $node): VaultNodeViewModel => VaultNodeViewModel::fromModel($node));

        return response()->json([
            'children' => $children,
        ]);
    }
}
