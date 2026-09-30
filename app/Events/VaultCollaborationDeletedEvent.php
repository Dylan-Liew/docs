<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\User;
use App\Models\Vault;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

final class VaultCollaborationDeletedEvent implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    public function __construct(
        private Vault $vault,
        private User $user,
    ) {
        //
    }

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return $this->vault->channels();
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'data' => [
                'user_id' => $this->user->id,
            ],
        ];
    }
}
