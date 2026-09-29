<?php

declare(strict_types=1);

namespace App\Queries\Vaults;

use App\Models\User;
use App\Models\Vault;
use Illuminate\Database\Eloquent\Builder;

final readonly class VisibleVaultsQuery
{
    /**
     * @return Builder<Vault>
     */
    public function __invoke(User $user): Builder
    {
        return Vault::query()
            ->where(function (Builder $query) use ($user): void {
                $query->where('created_by', $user->id)
                    ->orWhereHas('collaborators', function (Builder $collaborators) use ($user): void {
                        $collaborators->where('user_id', $user->id)->where('accepted', true);
                    });
            });
    }
}
