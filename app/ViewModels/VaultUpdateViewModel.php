<?php

declare(strict_types=1);

namespace App\ViewModels;

use App\Models\Vault;

final readonly class VaultUpdateViewModel
{
    public function __construct(
        public string $name,
        public ?int $templates_node_id,
        public bool $is_public,
        public ?string $share_url,
    ) {
        //
    }

    public static function fromModel(Vault $vault): self
    {
        return new self(
            $vault->name,
            $vault->templates_node_id,
            $vault->is_public,
            $vault->shareUrl(),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'templates_node_id' => $this->templates_node_id,
            'is_public' => $this->is_public,
            'share_url' => $this->share_url,
        ];
    }
}
