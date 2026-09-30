<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\VaultCollaborationController;
use App\Http\Controllers\VaultController;
use App\Http\Controllers\VaultEditorApplyTemplateController;
use App\Http\Controllers\VaultEditorSearchController;
use App\Http\Controllers\VaultExportController;
use App\Http\Controllers\VaultImportController;
use App\Http\Controllers\VaultNodeChildrenController;
use App\Http\Controllers\VaultNodeController;
use App\Http\Controllers\VaultNodeImportController;
use App\Http\Controllers\VaultNodeMoveController;
use App\Http\Controllers\VaultSearchController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function (): void {
    // Render home at / instead of redirecting, so WebKit associates the tab icon with the URL users open.
    Route::get('/', [VaultController::class, 'index'])->name('dashboard.index');

    Route::prefix('vaults')->name('vaults.')->group(function (): void {
        Route::get('', [VaultController::class, 'index'])->name('index');
        Route::post('', [VaultController::class, 'store'])->name('store');

        Route::prefix('{vault}')->group(function (): void {
            Route::get('', [VaultController::class, 'show'])->name('show');
            Route::patch('', [VaultController::class, 'update'])->name('update');
            Route::delete('', [VaultController::class, 'destroy'])->name('destroy');
            Route::get('export', VaultExportController::class)->name('export');
        });

        Route::post('import', VaultImportController::class)->name('import');
    });

    Route::prefix('vaults/{vault}')->name('vaults.nodes.')->group(function (): void {
        Route::get('nodes', VaultNodeChildrenController::class)->name('roots');
        Route::post('nodes', [VaultNodeController::class, 'store'])->name('store');

        Route::prefix('nodes/{node}')->scopeBindings()->group(function (): void {
            Route::patch('', [VaultNodeController::class, 'update'])->name('update');
            Route::delete('', [VaultNodeController::class, 'destroy'])->name('destroy');
            Route::get('children', VaultNodeChildrenController::class)->name('children');
            Route::patch('move', VaultNodeMoveController::class)->name('move');
        });

        Route::post('import', VaultNodeImportController::class)->name('import');
    });

    Route::prefix('vaults/{vault}/collaborations')->name('vaults.collaborations.')->group(function (): void {
        Route::get('', [VaultCollaborationController::class, 'index'])->middleware('throttle:60,1')->name('index');
        Route::post('', [VaultCollaborationController::class, 'store'])->name('store');
        Route::patch('', [VaultCollaborationController::class, 'update'])->name('update');
        Route::delete('{user}', [VaultCollaborationController::class, 'destroy'])->name('destroy');
    });

    Route::get('vaults/{vault}/search', VaultSearchController::class)->name('vaults.search');

    Route::prefix('vaults/{vault}/editor')->name('vaults.editor.')->group(function (): void {
        Route::get('search', VaultEditorSearchController::class)->name('search');
        Route::post('templates/{template}/apply', VaultEditorApplyTemplateController::class)->name('templates.apply');
    });

    Route::get('files/{vault}', [FileController::class, 'show'])->name('files.show');

    Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');

    Route::post('logout', LogoutController::class)->name('logout');
});
