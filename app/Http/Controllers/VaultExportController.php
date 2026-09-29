<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ExportVault;
use App\Models\User;
use App\Models\Vault;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

final readonly class VaultExportController
{
    public function __invoke(
        Vault $vault,
        #[CurrentUser] User $user,
        ExportVault $exportVault,
    ): BinaryFileResponse|JsonResponse {
        abort_unless($user->can('view', $vault), 403);

        try {
            $path = $exportVault->handle($vault);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'The vault could not be exported. Please try again.',
            ], 500);
        }

        return response()->download($path, $vault->name.'.zip', [
            'Content-Type' => 'application/zip',
            'Cache-Control' => 'private, no-store',
        ])->deleteFileAfterSend(true);
    }
}
