<?php

declare(strict_types=1);

namespace App\Actions;

use App\Events\VaultDeletedEvent;
use App\Events\VaultListUpdatedEvent;
use App\Models\Vault;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

final readonly class DeleteVault
{
    public function handle(Vault $vault): void
    {
        $collaborators = $vault->is_public
            ? User::where('email', '!=', config('docs.agent'))->where('id', '!=', $vault->created_by)->get()
            : $vault->collaborators()->get();
        $deleted = new VaultDeletedEvent($vault);

        try {
            DB::beginTransaction();

            // Delete collaborators
            $vault->collaborators()->detach();

            // Delete vault from database
            $this->deleteFromDatabase($vault);

            DB::commit();
        } catch (Throwable) {
            DB::rollBack();

            throw new Exception(__('Something went wrong'));
        }

        // Delete vault from disk
        $this->deleteFromDisk($vault);

        // Broadcast events
        broadcast(new VaultListUpdatedEvent($vault->user))->toOthers();

        foreach ($collaborators as $collaborator) {
            broadcast(new VaultListUpdatedEvent($collaborator))->toOthers();
        }

        broadcast($deleted)->toOthers();
    }

    /**
     * Delete vault from the database.
     */
    private function deleteFromDatabase(Vault $vault): void
    {
        $deleteVaultNode = app(DeleteVaultNode::class);
        $rootNodes = $vault->nodes()->whereNull('parent_id')->get();

        foreach ($rootNodes as $node) {
            $deleteVaultNode->handle($node, false);
        }

        $vault->delete();
    }

    /**
     * Delete vault from the disk.
     */
    private function deleteFromDisk(Vault $vault): void
    {
        $vaultPath = app(GetPathFromUser::class)->handle($vault->user) . $vault->name;

        if (!Storage::disk('local')->exists($vaultPath)) {
            return;
        }

        Storage::disk('local')->deleteDirectory($vaultPath);
    }
}
