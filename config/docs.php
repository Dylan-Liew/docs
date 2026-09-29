<?php

declare(strict_types=1);

return [
    'team' => env('CF_ACCESS_TEAM_DOMAIN'),
    'aud' => env('CF_ACCESS_AUD'),
    // Reserved legacy account; never used to authenticate browser or MCP requests.
    'agent' => env('MCP_EMAIL', 'agent@docs.x44ylan.com'),
];
