<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final readonly class LogoutController
{
    public function __invoke(Request $request): RedirectResponse|SymfonyResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if (config('docs.aud')) {
            $appUrl = is_string(config('app.url')) ? mb_rtrim(config('app.url'), '/') : '';

            return Inertia::location($appUrl . '/cdn-cgi/access/logout');
        }

        return redirect('/');
    }
}
