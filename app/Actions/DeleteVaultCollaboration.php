<?php

declare(strict_types=1);

namespace App\Actions;

use App\Events\VaultCollaborationAccessRevokedEvent;
use App\Events\VaultCollaborationDeletedEvent;
use App\Models\User;
use App\Models\Vault;
use App\Models\VaultCollaborator;

final readonly class DeleteVaultCollaboration
{
    /** @param User&object{pivot: VaultCollaborator} $user */
    public function handle(Vault $vault, User $user): void
    {
        $wasAccepted = (bool) $user->pivot->accepted;

        $vault->collaborators()->detach($user);

        broadcast(new VaultCollaborationDeletedEvent($vault, $user))->toOthers();

        if ($wasAccepted && !$vault->is_public) {
            broadcast(new VaultCollaborationAccessRevokedEvent($vault, $user));
        }
    }
}
