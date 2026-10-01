<?php

declare(strict_types=1);
use App\Actions\CreateVault;
use App\Actions\CreateVaultNode;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Cache;

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
Cache::put('docs.access.keys', ['keys' => [$input['key']]], 3600);

$owner = User::create(['name' => 'Alex', 'email' => 'alex@example.test', 'password' => bin2hex(random_bytes(32)), 'role' => UserRole::USER]);
$other = User::create(['name' => 'Sam', 'email' => 'sam@example.test', 'password' => bin2hex(random_bytes(32)), 'role' => UserRole::USER]);
$agent = User::create(['name' => 'Agent', 'email' => 'agent@example.test', 'password' => bin2hex(random_bytes(32)), 'role' => UserRole::USER]);
$vaults = [];
$legacy = null;
foreach (['Product', 'Engineering', 'Research & references', 'A very long vault name for responsive layout checks', 'Shared playbook', 'Private archive'] as $i => $name) {
    $vault = app(CreateVault::class)->handle($i < 4 ? $owner : $other, ['name' => $name], false);
    $vaults[] = $vault->id;
    if ($i === 0 && ($input['legacy'] ?? false)) {
        $token = bin2hex(random_bytes(32));
        $vault->update(['share_token' => $token]);
        $legacy = ['id' => $vault->id, 'token' => $token];
    }
    if ($i === 0) {
        $vault->collaborators()->attach($agent, ['accepted' => true]);
    }
    if ($i === 4) {
        $vault->collaborators()->attach($owner, ['accepted' => true]);
    }
    if ($i === 5) {
        $vault->collaborators()->attach($owner, ['accepted' => false]);
    }
    foreach (['Getting started', 'Roadmap', 'Decisions'] as $j => $title) {
        $node = app(CreateVaultNode::class)->handle($vault, ['name' => $title, 'is_file' => true, 'extension' => 'md', 'content' => "# {$title}\n\nA shared place for clear thinking.\n"], false, false);
        $node->update(['updated_at' => now()->subHours($i * 3 + $j)]);
    }
}
echo json_encode(['vaults' => $vaults, 'legacy' => $legacy]);
