<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CheckParent;
use App\Actions\GetAvailableVaultNodeName;
use App\Actions\UpdateVaultNode;
use App\Http\Requests\MoveVaultNodeRequest;
use App\Models\User;
use App\Models\Vault;
use App\Models\VaultNode;
use App\ViewModels\VaultNodeViewModel;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final readonly class VaultNodeMoveController
{
    public function __invoke(
        MoveVaultNodeRequest $request,
        Vault $vault,
        VaultNode $node,
        #[CurrentUser] User $user,
    ): JsonResponse {
        abort_unless($user->can('update', $vault), 403);

        /** @var array{ parent_id: int|null } $data */
        $data = $request->validated();

        return DB::transaction(function () use ($vault, $node, $data): JsonResponse {
            // Serialize structural changes within a vault before checking ancestry.
            Vault::whereKey($vault->id)->lockForUpdate()->firstOrFail();
            $node->refresh();
            app(CheckParent::class)->handle($vault, $data['parent_id'], $node);

            // Generate a new filename if it already exists in the destination folder
            $name = app(GetAvailableVaultNodeName::class)->handle(
                $vault,
                $data['parent_id'],
                $node->is_file,
                $node->name,
                $node->extension,
                $node->id,
            );

            $updatedNode = app(UpdateVaultNode::class)->handle($node, [
                'parent_id' => $data['parent_id'],
                'name' => $name,
            ]);

            return response()->json([
                'data' => VaultNodeViewModel::fromModel($updatedNode),
            ]);
        });
    }
}
