<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        // The email is owned by Cloudflare Access and stays immutable.
        return [
            'name' => ['required', 'string', 'max:255'],
        ];
    }
}
