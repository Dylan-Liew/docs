<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\User;
use Closure;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use stdClass;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * @phpstan-type AccessJwks array{keys: list<array<string, mixed>>}
 */
final class Access
{
    public function verify(string $token, string $aud): stdClass
    {
        $team = config('docs.team');
        abort_unless(
            is_string($team)
            && preg_match('/^[a-z0-9-]+\.cloudflareaccess\.com$/D', $team)
            && $aud !== '',
            503
        );
        try {
            /** @var AccessJwks $keys */
            $keys = Cache::remember('docs.access.keys', 300, function () use ($team): array {
                /** @var AccessJwks $certs */
                $certs = Http::timeout(5)->withoutRedirecting()
                    ->get("https://{$team}/cdn-cgi/access/certs")->throw()->json();

                return $certs;
            });
            // Restrict keys and JWT algorithms to RS256, including when a JWK declares its own alg.
            $keys['keys'] = array_values(array_filter(
                $keys['keys'],
                fn(array $key): bool => ($key['kty'] ?? '') === 'RSA' && ($key['alg'] ?? 'RS256') === 'RS256'
            ));
            $claims = JWT::decode($token, JWK::parseKeySet($keys, 'RS256'));
            if (
                ($claims->iss ?? '') !== "https://{$team}" ||
                !in_array($aud, (array) ($claims->aud ?? []), true) ||
                !is_numeric($claims->exp ?? null) || $claims->exp <= time() ||
                (empty($claims->sub) && empty($claims->common_name))
            ) {
                throw new RuntimeException();
            }
        } catch (Throwable) {
            abort(403, 'Cloudflare identity could not be verified. Sign in again.');
        }

        return $claims;
    }

    public function user(Request $request): User
    {
        $aud = config('docs.aud');
        abort_unless(is_string($aud) && $aud !== '', 503);
        // An existing Laravel session or a plain email header never bypasses Access.
        $claims = $this->verify((string) $request->header('Cf-Access-Jwt-Assertion'), $aud);
        // Service tokens have no human identity and cannot inherit a user's access.
        abort_unless(is_string($claims->sub ?? null) && $claims->sub !== '' && empty($claims->common_name), 403);
        $rawEmail = $claims->email ?? '';
        abort_unless(is_string($rawEmail) && filter_var($rawEmail, FILTER_VALIDATE_EMAIL) !== false, 403);

        // Cloudflare Access is the single source of truth: every verified identity
        // is allowed in and is provisioned on first sign-in.
        $email = mb_strtolower($rawEmail);

        // Keep the retired shared account disabled on both entry points.
        $agent = config('docs.agent');
        abort_if(is_string($agent) && $email === mb_strtolower($agent), 403, 'Sign in with your personal account.');

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user === null) {
            $claimName = $claims->name ?? '';
            $name = is_string($claimName) ? mb_trim($claimName) : '';
            if ($name === '') {
                $name = ucfirst(strtok($email, '@') ?: 'User');
            }

            try {
                $user = User::create([
                    'name' => mb_substr($name, 0, 255),
                    'email' => $email,
                    'password' => Str::random(64),
                    'role' => UserRole::USER,
                ]);
            } catch (UniqueConstraintViolationException) {
                // Concurrent first visits for the same identity: use the winner's row.
                $user = User::whereRaw('LOWER(email) = ?', [$email])->firstOrFail();
            }
        }

        return $user;
    }

    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $aud = config('docs.aud');
        if (!is_string($aud) || $aud === '') {
            return $next($request);
        }
        $user = $this->user($request);
        if (Auth::id() !== $user->id) {
            $request->session()->invalidate();
            Auth::login($user);
            $request->session()->regenerate();
        }

        return $next($request);
    }
}
