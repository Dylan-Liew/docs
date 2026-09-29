<?php

declare(strict_types=1);

namespace App\Actions;

use App\Events\VaultListUpdatedEvent;
use App\Models\User;
use App\Services\VaultFile;
use App\Services\VaultFiles\Types\Note;
use finfo;
use ZipArchive;

final readonly class ProcessImportedVault
{
    public function handle(User $user, string $fileName, string $filePath): void
    {
        $createVaultNode = app(CreateVaultNode::class);

        $nodeIds = ['.' => null];
        $vaultName = pathinfo($fileName, PATHINFO_FILENAME);
        $vault = app(CreateVault::class)->handle($user, ['name' => $vaultName], false);

        // Create vault nodes with valid zip files and folders
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $zip = new ZipArchive();
        $zip->open($filePath);
        $metadata = json_decode((string) $zip->getFromName('.docs.json'), true);
        $noteParents = is_array($metadata['note_parents'] ?? null) ? $metadata['note_parents'] : [];

        for ($i = 0, $zipCount = $zip->count(); $i < $zipCount; $i++) {
            $entryName = $zip->getNameIndex($i);

            if (!$entryName) {
                continue;
            }
            if ($entryName === '.docs.json') {
                continue;
            }

            // Reject any entry containing path traversal sequences
            $normalizedEntry = str_replace('\\', '/', $entryName);
            $pieces = explode('/', $normalizedEntry);

            if (in_array('..', $pieces)) {
                continue;
            }

            $isFile = !str_ends_with($entryName, '/');
            $flags = $isFile ? PATHINFO_FILENAME : PATHINFO_BASENAME;
            $attributes = [
                'is_file' => $isFile,
                'name' => pathinfo($entryName, $flags),
                'extension' => null,
                'content' => null,
            ];

            if (!$isFile) {
                // ZipArchive folder paths end with a / that should
                // be removed in order for pathinfo() return the correct dirname
                $entryDirName = mb_rtrim($entryName, '/');
                if (in_array($entryDirName, $noteParents, true) && isset($nodeIds[$entryDirName])) {
                    continue;
                }
                $entryParentDirName = pathinfo($entryDirName, PATHINFO_DIRNAME);
                $attributes['parent_id'] = $nodeIds[$entryParentDirName] ?? null;
            } else {
                $pathInfo = pathinfo($entryName);
                $entryDirName = $pathInfo['dirname'];
                $attributes['extension'] = $pathInfo['extension'] ?? '';
                $attributes['parent_id'] = $nodeIds[$entryDirName] ?? null;
                $attributes['content'] = (string) $zip->getFromIndex($i);
                $fileMimeType = $finfo->buffer($attributes['content']) ?: '';

                $emptyNote = $attributes['content'] === '' && in_array($attributes['extension'], Note::extensions());
                if (!$emptyNote && !VaultFile::validate($attributes['extension'], $fileMimeType)) {
                    continue;
                }

                if (in_array($attributes['extension'], Note::extensions())) {
                    $attributes['extension'] = 'md';
                }
            }

            $node = $createVaultNode->handle($vault, $attributes, false, false);
            $notePath = substr($entryName, 0, -3);
            if ($isFile && $node->extension === 'md' && in_array($notePath, $noteParents, true)) {
                $nodeIds[$notePath] = $node->id;
            }

            if (!array_key_exists($entryDirName, $nodeIds)) {
                $nodeIds[$entryDirName] = $node->id;
            }
        }

        $zip->close();

        app(ProcessVaultLinks::class)->handle($vault);
        app(ProcessVaultTags::class)->handle($vault);

        // Broadcast event
        broadcast(new VaultListUpdatedEvent($user))->toOthers();
    }
}
