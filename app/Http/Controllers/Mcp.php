<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Middleware\Access;
use App\Mcp\Tools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class Mcp
{
    private const array VERSIONS = ['2025-03-26', '2025-06-18', '2025-11-25'];

    public function __invoke(Request $request, Access $access, Tools $tools): Response
    {
        abort_if($request->headers->has('Origin') && $request->header('Origin') !== (is_string(config('app.url')) ? mb_rtrim(config('app.url'), '/') : ''), 403);
        $user = $access->user($request);
        Auth::setUser($user);
        if (! $request->isMethod('POST')) {
            return response('', 405, ['Allow' => 'POST']);
        }
        abort_unless(in_array($request->header('MCP-Protocol-Version', '2025-03-26'), self::VERSIONS, true), 400);
        abort_unless($request->isJson(), 415);
        abort_unless(str_contains($request->header('Accept', ''), 'application/json') &&
            str_contains($request->header('Accept', ''), 'text/event-stream'), 406);
        abort_if(mb_strlen($request->getContent()) > 1100000, 413);
        $body = json_decode($request->getContent());
        if (json_last_error() !== JSON_ERROR_NONE) {
            return response()->json(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32700, 'message' => 'Parse error']], 400);
        }
        if (
            ! is_object($body) || ($body->jsonrpc ?? '') !== '2.0' || ! is_string($body->method ?? null) ||
            (isset($body->params) && ! is_object($body->params)) ||
            (isset($body->id) && ! is_string($body->id) && ! is_int($body->id))
        ) {
            return response()->json(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32600, 'message' => 'Invalid request']], 400);
        }
        if (! property_exists($body, 'id')) {
            abort_unless(str_starts_with($body->method, 'notifications/'), 400);

            return response('', 202);
        }
        $initializeParams = $body->params ?? null;
        $requestedVersion = is_object($initializeParams) && isset($initializeParams->protocolVersion)
            ? $initializeParams->protocolVersion : '';
        $result = match ($body->method) {
            'initialize' => [
                'protocolVersion' => is_string($requestedVersion) && in_array($requestedVersion, self::VERSIONS, true)
                    ? $requestedVersion : '2025-11-25',
                'capabilities' => ['tools' => (object) []],
                'serverInfo' => ['name' => 'Docs', 'version' => '1.0.0'],
            ],
            'ping' => (object) [],
            'tools/list' => ['tools' => $tools->definitions()],
            'tools/call' => $tools->call(is_object($body->params ?? null) ? $body->params : (object) [], $user),
            default => null,
        };

        return response()->json(['jsonrpc' => '2.0', 'id' => $body->id, ...($result === null
            ? ['error' => ['code' => -32601, 'message' => 'Method not found']]
            : ['result' => $result])])->header('Cache-Control', 'no-store');
    }
}
