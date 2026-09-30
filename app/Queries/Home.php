<?php

declare(strict_types=1);

namespace App\Queries;

use App\Models\User;
use App\Models\VaultNode;
use App\Queries\Vaults\VisibleVaultsQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final readonly class Home
{
    public function __construct(private VisibleVaultsQuery $visible) {}

    public function vaults(User $user): Collection
    {
        return ($this->visible)($user)
            ->select(['id', 'name', 'created_by', 'updated_at', 'is_public'])
            ->withCount([
                'collaborators as accepted_collaborators_count' => fn (Builder $query) => $query->where('accepted', true),
                'nodes as documents_count' => fn (Builder $query) => $query->where('is_file', true),
            ])
            ->withMax(['nodes as last_document_update' => fn (Builder $query) => $query->where('is_file', true)], 'updated_at')
            ->get()
            ->map(function ($vault): array {
                $data = $vault->toArray();
                $data['activity_at'] = max($vault->updated_at->toISOString(), $vault->last_document_update
                    ? Carbon::parse($vault->last_document_update)->toISOString() : '');
                unset($data['last_document_update']);

                return $data;
            })
            ->sortByDesc('activity_at')->values();
    }

    public function recent(User $user): Collection
    {
        return VaultNode::query()
            ->whereIn('vault_id', ($this->visible)($user)->select('id'))
            ->where('is_file', true)
            ->with('vault:id,name')
            ->orderByDesc('updated_at')->orderByDesc('id')->limit(6)
            ->get(['id', 'vault_id', 'name', 'updated_at'])
            ->map(fn (VaultNode $node): array => [
                ...$node->only(['id', 'vault_id', 'name', 'updated_at']),
                'vault_name' => $node->vault->name,
            ]);
    }
}
