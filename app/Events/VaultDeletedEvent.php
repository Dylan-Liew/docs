<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Vault;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

final class VaultDeletedEvent implements ShouldBroadcastNow
{
    use InteractsWithSockets;
    private array $channels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        private Vault $vault
    ) {
        $this->channels = $vault->channels();
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return $this->channels;
    }
}
