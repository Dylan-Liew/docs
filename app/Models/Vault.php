<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use App\Services\VaultFiles\Types\Note;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Override;
use Staudenmeir\EloquentHasManyDeep\HasManyDeep;
use Staudenmeir\EloquentHasManyDeep\HasRelationships;

/**
 * @property-read int $id
 * @property-read string $name
 * @property-read int $created_by
 * @property-read bool $is_public
 * @property-read string|null $share_token
 * @property-read CarbonImmutable|null $opened_at
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable $updated_at
 * @property-read User $user
 * @property-read Collection<int, VaultNode> $nodes
 * @property-read Collection<int, Tag> $tags
 * @property-read VaultNode|null $templatesNode
 * @property-read Collection<int, User> $collaborators
 */
final class Vault extends Model
{
    use HasRelationships;

    protected $hidden = ['share_token'];

    public function shareUrl(): ?string
    {
        $token = $this->share_token;
        if ($token === null) return null;
        // Keep legacy URLs valid while presenting their 128-bit prefix compactly.
        if (strlen($token) === 64 && ctype_xdigit($token)) {
            $token = rtrim(strtr(base64_encode(hex2bin(substr($token, 0, 32))), '+/', '-_'), '=');
        }
        return rtrim(config('app.url'), '/') . '/share/' . $token;
    }

    /** @return Builder<self> */
    public static function shared(string $token): Builder
    {
        return static::query()->where(function (Builder $query) use ($token): void {
            $query->where('share_token', $token);
            if (strlen($token) !== 22) return;
            $bytes = base64_decode(strtr($token, '-_', '+/') . '==', true);
            if ($bytes === false || strlen($bytes) !== 16
                || rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=') !== $token) return;
            $query->orWhere(fn (Builder $legacy) => $legacy
                ->where('share_token', 'like', bin2hex($bytes) . '%')
                ->whereRaw('length(share_token) = 64'));
        });
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<VaultNode, $this> */
    public function nodes(): HasMany
    {
        return $this->hasMany(VaultNode::class);
    }

    public function mainNote(): ?VaultNode
    {
        return $this->nodes()
            ->whereNull('parent_id')
            ->where('is_file', true)
            ->whereIn('extension', Note::extensions())
            ->where(fn (Builder $query) => $query
                ->whereRaw('LOWER(name) = LOWER(?)', [$this->name])
                ->orWhereRaw('LOWER(name) = ?', ['index']))
            ->orderByRaw('CASE WHEN LOWER(name) = LOWER(?) THEN 0 ELSE 1 END', [$this->name])
            ->orderBy('id')
            ->first();
    }

    /** @return HasManyDeep<Model, $this> */
    public function tags(): HasManyDeep
    {
        return $this->hasManyDeepFromRelations($this->nodes(), new VaultNode()->tags());
    }

    /** @return HasOne<VaultNode, $this> */
    public function templatesNode(): HasOne
    {
        return $this->hasOne(VaultNode::class, 'id', 'templates_node_id');
    }

    /** @return BelongsToMany<User, $this, VaultCollaborator> */
    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('accepted')
            ->using(VaultCollaborator::class);
    }

    /** @return array<int, PrivateChannel> */
    public function channels(): array
    {
        // Re-evaluate recipients for every event. A revoked socket can remain
        // connected, but its user-specific channel receives no further content.
        $public = self::whereKey($this->id)->value('is_public');
        $ids = $public
            ? User::where('email', '!=', config('docs.agent'))->pluck('id')
            : $this->collaborators()->wherePivot('accepted', true)->pluck('users.id')->push($this->created_by);

        return $ids->unique()->map(fn ($id) => new PrivateChannel('Vault.' . $this->id . '.' . $id))->values()->all();
    }

    #[Override]
    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'opened_at' => 'datetime',
        ];
    }
}
