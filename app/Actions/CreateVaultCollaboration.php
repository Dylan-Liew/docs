<?php

declare(strict_types=1);

namespace App\Actions;

use App\Events\VaultCollaborationCreatedEvent;
use App\Models\User;
use App\Models\Vault;

final readonly class CreateVaultCollaboration
{
    public function handle(Vault $vault, User $user): User
    {
        $vault->collaborators()->attach($user, ['accepted' => 1]);

        $collaborator = $vault->collaborators()->wherePivot('user_id', $user->id)->firstOrFail();

        broadcast(new VaultCollaborationCreatedEvent($vault, $collaborator))->toOthers();

        return $collaborator;
    }
}
