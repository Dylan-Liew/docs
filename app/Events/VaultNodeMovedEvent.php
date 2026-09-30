<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\VaultNode;
use App\ViewModels\VaultNodeViewModel;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

final class VaultNodeMovedEvent implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    public function __construct(
        private VaultNode $node,
        private ?int $oldParentId,
    ) {
        //
    }

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return $this->node->vault->channels();
    }

    /** @return array<string, array<string, mixed>> */
    public function broadcastWith(): array
    {
        return [
            'data' => [
                'node' => VaultNodeViewModel::fromModel($this->node),
                'old_parent_id' => $this->oldParentId,
            ],
        ];
    }
}
