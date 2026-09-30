<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateVaultCollaboration;
use App\Actions\DeleteVaultCollaboration;
use App\Events\VaultListUpdatedEvent;
use App\Events\VaultUpdatedEvent;
use App\Events\VaultCollaborationAccessRevokedEvent;
use App\Http\Requests\StoreVaultCollaborationRequest;
use App\Models\User;
use App\Models\Vault;
use App\ViewModels\VaultCollaboratorViewModel;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final readonly class VaultCollaborationController
{
    public function update(Request $request, Vault $vault, #[CurrentUser] User $user): JsonResponse
    {
        abort_unless($user->can('update', $vault), 403);
        $data = $request->validate(['is_public' => ['required', 'boolean']]);
        $vault->update($data);
        if (!$vault->wasChanged('is_public')) {
            return response()->json(['data' => ['is_public' => $vault->is_public]]);
        }
        broadcast(new VaultUpdatedEvent($vault))->toOthers();
        foreach (User::where('email', '!=', config('docs.agent'))->cursor() as $recipient) {
            broadcast(new VaultListUpdatedEvent($recipient))->toOthers();
            if (!$vault->is_public && $recipient->cannot('view', $vault)) {
                broadcast(new VaultCollaborationAccessRevokedEvent($vault, $recipient));
            }
        }

        return response()->json(['data' => ['is_public' => $vault->is_public]]);
    }

    public function index(Request $request, Vault $vault, #[CurrentUser] User $user): JsonResponse
    {
        abort_unless($user->can('view', $vault), 403);
        $data = $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $query = mb_strtolower(trim($data['q'] ?? ''));
        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $pattern = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query) . '%';
        $people = User::query()
            ->where('id', '!=', $vault->created_by)
            ->where('email', '!=', config('docs.agent'))
            ->whereDoesntHave('collaborations', fn ($query) => $query->where('vaults.id', $vault->id))
            ->where(fn ($query) => $query
                ->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("LOWER(email) LIKE ? ESCAPE '!'", [$pattern]))
            ->orderBy('name')->orderBy('id')->limit(8)->get(['id', 'name', 'email']);

        return response()->json(['data' => $people])->header('Cache-Control', 'private, no-store');
    }

    public function store(
        StoreVaultCollaborationRequest $request,
        Vault $vault,
        #[CurrentUser] User $currentUser,
        CreateVaultCollaboration $createVaultCollaboration,
    ): JsonResponse {
        abort_unless($currentUser->can('view', $vault), 403);

        /** @var array{email: string} $validated */
        $validated = $request->validated();

        /** @var User $invitedUser */
        $invitedUser = User::where('email', $validated['email'])->first();

        if ($invitedUser->id === $vault->created_by) {
            throw ValidationException::withMessages([
                'email' => __('User is the owner of this vault'),
            ]);
        }

        try {
            $collaborator = $vault->collaborators()
                ->wherePivot('user_id', $invitedUser->id)
                ->firstOrFail();

            $message = $collaborator->pivot->accepted
                ? __('User is already a collaborator')
                : __('User is already invited');

            throw ValidationException::withMessages([
                'email' => $message,
            ]);
        } catch (ModelNotFoundException) {
            $collaborator = $createVaultCollaboration->handle($vault, $invitedUser);

            return response()->json([
                'data' => VaultCollaboratorViewModel::fromModel($collaborator)->toArray(),
            ]);
        }
    }

    public function destroy(
        Vault $vault,
        User $user,
        #[CurrentUser] User $currentUser,
        DeleteVaultCollaboration $deleteVaultCollaboration,
    ): JsonResponse {
        abort_unless($currentUser->id === $vault->user->id || $currentUser->id === $user->id, 403);

        $collaborator = $vault->collaborators()
            ->wherePivot('user_id', $user->id)
            ->firstOrFail();

        $deleteVaultCollaboration->handle($vault, $collaborator);

        return response()->json();
    }
}
