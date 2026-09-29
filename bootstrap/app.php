<?php

declare(strict_types=1);

use App\Http\Controllers\Mcp;
use App\Http\Middleware\Access;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        channels: __DIR__ . '/../routes/channels.php',
        health: '/up',
        then: function (): void {
            Route::any('/mcp', Mcp::class)->middleware('throttle:120,1');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*')
            ->web(append: [
                Access::class,
                HandleInertiaRequests::class,
            ]);
        $middleware->prependToPriorityList(Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests::class, Access::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn(Request $request): bool => $request->is('api/*', 'mcp') || $request->expectsJson(),
        );
    })->create();
