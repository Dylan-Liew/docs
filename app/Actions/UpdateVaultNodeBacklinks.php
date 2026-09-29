<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\VaultNode;
use Illuminate\Support\Facades\DB;

final readonly class UpdateVaultNodeBacklinks
{
    public function handle(VaultNode $node, string $originalLinkPath): void
    {
        $newRoot = $node->fullPath();
        $targets = $node->descendantsAndSelf()->where('is_file', true)->get();
        $paths = [];
        $oldPaths = [];
        foreach ($targets as $target) {
            $new = $target->fullPath();
            $old = $originalLinkPath.substr($new, strlen($newRoot));
            $oldPaths[$target->id] = $old;
            $paths[mb_strtolower($old.'.'.$target->extension)] = $new.'.'.$target->extension;
            if ($target->extension === 'md') $paths[mb_strtolower($old)] = $new.'.md';
        }

        // Snapshot all sources before saving any content: reparsing the first
        // replacement would otherwise detach links to not-yet-updated children.
        $sources = DB::table('vault_node_vault_node')->whereIn('destination_id', $targets->modelKeys())->pluck('source_id');
        $backlinks = $node->vault->nodes()->where('extension', 'md')
            ->whereIn('id', $sources->merge($targets->modelKeys())->unique())->get();

        foreach ($backlinks as $backlink) {
            if ($backlink->content === null || $backlink->content === '') continue;
            $sourcePath = $oldPaths[$backlink->id] ?? $backlink->fullPath();
            $content = preg_replace_callback('/(!?\[[^\]]*\]\()([^\r\n]*?)(\s+"[^"]*")?(\))/',
                function (array $match) use ($sourcePath, $paths, $oldPaths, $backlink): string {
                    $url = $match[2];
                    if (preg_match('/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i', $url)) return $match[0];
                    $resolved = ltrim(app(ResolveTwoPaths::class)->handle('/'.$sourcePath, $url), '/');
                    $replacement = $paths[mb_strtolower($resolved)] ?? null;
                    // A moved note's relative links to documents outside the
                    // subtree must still point to their original destinations.
                    if ($replacement === null && isset($oldPaths[$backlink->id]) && !str_starts_with($url, '/')) {
                        if (app(GetVaultNodeFromPath::class)->handle($backlink->vault_id, $resolved)) $replacement = $resolved;
                    }
                    if ($replacement === null) return $match[0];
                    return $match[1].'/'.str_replace(' ', '%20', $replacement).($match[3] ?? '').$match[4];
                }, (string) $backlink->content);

            if ($content !== $backlink->content) {
                app(UpdateVaultNode::class)->handle($backlink, ['content' => $content], true);
            }
        }
    }
}
