<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Vault;
use App\Models\VaultNode;
use Illuminate\Validation\ValidationException;

final readonly class CheckParent
{
    public function handle(Vault $vault, ?int $parentId, ?VaultNode $node = null): void
    {
        if ($parentId === null) {
            return;
        }

        $parent = $vault->nodes()->find($parentId);
        $message = null;
        if (!$parent || ($parent->is_file && $parent->extension !== 'md')) {
            $message = 'Choose a note or folder in this vault.';
        } elseif ($node && ($node->id === $parentId || $node->descendants()->whereKey($parentId)->exists())) {
            $message = 'A note or folder cannot be moved inside itself.';
        } elseif ($parent->is_file && $vault->nodes()->where('parent_id', $parent->parent_id)
            ->where('is_file', false)->whereRaw('LOWER(name) = LOWER(?)', [$parent->name])->exists()) {
            $message = 'Rename this note or its same-named folder before adding sub-notes.';
        }

        if ($message) {
            throw ValidationException::withMessages(['parent_id' => $message]);
        }
    }
}
