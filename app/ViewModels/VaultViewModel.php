<?php

declare(strict_types=1);

namespace App\ViewModels;

use App\Models\Vault;
use Illuminate\Support\Collection as SupportCollection;

final readonly class VaultViewModel
{
    /** @param SupportCollection<int, VaultCollaboratorViewModel> $collaborators */
    public function __construct(
        public int $id,
        public string $name,
        public ?int $templates_node_id,
        public VaultUserViewModel $user,
        public SupportCollection $collaborators,
        public bool $is_public,
        public ?string $share_url,
    ) {
        //
    }

    public static function fromModel(Vault $vault): self
    {
        return new self(
            $vault->id,
            $vault->name,
            $vault->templates_node_id,
            VaultUserViewModel::fromModel($vault->user),
            $vault->collaborators()->get()->map(VaultCollaboratorViewModel::fromModel(...)),
            $vault->is_public,
            $vault->shareUrl(),
        );
    }
}
