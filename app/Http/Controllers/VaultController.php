<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateVault;
use App\Actions\DeleteVault;
use App\Actions\GetVaultNodeFromPath;
use App\Actions\ResolveTwoPaths;
use App\Actions\UpdateVault;
use App\Http\Requests\StoreVaultRequest;
use App\Http\Requests\UpdateVaultRequest;
use App\Models\User;
use App\Models\Vault;
use App\Queries\Home;
use App\ViewModels\VaultCreateViewModel;
use App\ViewModels\VaultDataViewModel;
use App\ViewModels\VaultNodeViewModel;
use App\ViewModels\VaultOpenedFileDataViewModel;
use App\ViewModels\VaultOpenedFileTreeDataViewModel;
use App\ViewModels\VaultUpdateViewModel;
use App\ViewModels\VaultViewModel;
use Exception;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final readonly class VaultController
{
    public function index(#[CurrentUser] User $user, Home $home): Response
    {
        return Inertia::render('vault/Index', [
            'visibleVaults' => fn () => $home->vaults($user),
            'recentDocuments' => fn () => $home->recent($user),
        ]);
    }

    public function store(StoreVaultRequest $request, #[CurrentUser] User $user, CreateVault $createVault): JsonResponse
    {
        /** @var array{name: string} $data */
        $data = $request->validated();

        $vault = $createVault->handle($user, $data);

        return response()->json([
            'data' => VaultCreateViewModel::fromModel($vault)->toArray(),
        ]);
    }

    public function show(
        Request $request,
        Vault $vault,
        #[CurrentUser] User $user,
    ): Response {
        abort_unless($user->can('view', $vault), 403);

        $data = [
            'vault' => fn (): VaultViewModel => VaultViewModel::fromModel($vault),
            'openedFile' => null,
        ];

        $file = $request->query('file');
        $path = $request->query('path');
        abort_unless(($file === null || is_string($file)) && ($path === null || is_string($path)), 404);
        $node = null;

        if (is_string($file)) {
            $file = $vault
                ->nodes()
                ->where('id', $file)
                ->where('is_file', true)
                ->firstOrFail();

            if (is_string($path)) {
                $resolvedPath = app(ResolveTwoPaths::class)->handle($file->fullPath(), $path);
                $file = app(GetVaultNodeFromPath::class)->handle($vault->id, $resolvedPath);

                abort_unless($file !== null, 404);
            }

            $node = $file;
        } elseif ($file === null && $path === null) {
            $node = $vault->mainNote();
        }

        if ($node !== null) {
            $data['openedFile'] = fn (): array => [
                'file' => VaultNodeViewModel::fromModel($node),
                ...(array) VaultOpenedFileDataViewModel::fromModel($node),
                ...(array) VaultOpenedFileTreeDataViewModel::fromModel($vault, $node),
            ];
        }

        return Inertia::render('vault/Show', $data)
            ->with(VaultDataViewModel::fromModel($vault));
    }

    public function update(
        UpdateVaultRequest $request,
        Vault $vault,
        #[CurrentUser] User $currentUser,
        UpdateVault $updateVault,
    ): JsonResponse {
        abort_unless($currentUser->can('update', $vault), 403);

        /** @var array{name?: string, templates_node_id?: int} $data */
        $data = $request->validated();

        $vault = $updateVault->handle($vault, $data);

        return response()->json([
            'data' => VaultUpdateViewModel::fromModel($vault)->toArray(),
        ]);
    }

    public function destroy(Vault $vault, #[CurrentUser] User $user, DeleteVault $deleteVault): void
    {
        if ($user->cannot('delete', $vault)) {
            throw ValidationException::withMessages([
                'delete' => __('Not allowed'),
            ]);
        }

        try {
            $deleteVault->handle($vault);
        } catch (Exception $e) {
            report($e);
            throw ValidationException::withMessages([
                'delete' => 'The vault could not be deleted. Please try again.',
            ]);
        }
    }
}
