<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Vault;
use App\Models\VaultNode;
use Exception;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Staudenmeir\LaravelAdjacencyList\Eloquent\Collection;
use Throwable;
use ZipArchive;

final readonly class ExportVault
{
    public function handle(Vault $vault): string
    {
        $zip = new ZipArchive;
        $relativePath = 'public/'.Str::random(16).'.zip';
        $path = Storage::disk('local')->path($relativePath);
        $nodes = $vault->nodes()->whereNull('parent_id')->get();

        if ($nodes->count() === 0) {
            throw ValidationException::withMessages(['vault' => 'Add a document before exporting this vault.']);
        }

        Storage::disk('local')->put($relativePath, '');

        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            Storage::disk('local')->delete($relativePath);
            throw new Exception(__('Something went wrong'), 500);
        }

        try {
            try {
                $this->exportNodes($zip, $nodes);
                $parents = [];
                foreach ($vault->nodes()->where('extension', 'md')->has('children')->get() as $note) {
                    $parents[] = $note->fullPath();
                }
                if ($parents !== []) {
                    $zip->addFromString('.docs.json', json_encode(['note_parents' => $parents], JSON_THROW_ON_ERROR));
                }
            } finally {
                $closed = $zip->close();
            }
            if (! $closed) {
                throw new Exception('Could not finalize the archive.');
            }
        } catch (Throwable $error) {
            Storage::disk('local')->delete($relativePath);
            throw $error;
        }

        return $path;
    }

    /**
     * @param  Collection<int, VaultNode>  $nodes
     */
    private function exportNodes(ZipArchive &$zip, Collection $nodes, string $path = ''): void
    {
        foreach ($nodes as $node) {
            $nodePath = mb_ltrim("$path/$node->name", '/');
            $nodePath .= $node->is_file ? ".$node->extension" : '';
            $relativePath = app(GetPathFromVaultNode::class)->handle($node);

            if (! Storage::disk('local')->exists($relativePath)) {
                throw new Exception(
                    sprintf(
                        "%s missing on disk: {$nodePath}",
                        $node->is_file ? 'File' : 'Folder',
                    ),
                    500,
                );
            }

            if (! $node->is_file) {
                $zip->addEmptyDir($nodePath);

                $this->exportNodes($zip, $node->children()->get(), $nodePath);
            } elseif ($node->extension === 'md') {
                $zip->addFromString($nodePath, (string) $node->content);
            } else {
                $zip->addFile(
                    Storage::disk('local')->path($relativePath),
                    $nodePath,
                );
            }
            if ($node->is_file && $node->children()->exists()) {
                $childPath = mb_ltrim("$path/$node->name", '/');
                $zip->addEmptyDir($childPath);
                $this->exportNodes($zip, $node->children()->get(), $childPath);
            }
        }
    }
}
