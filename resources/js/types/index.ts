export interface AppPageProps {
    app?: {
        user?: User;
        metadata?: Metadata;
    };
}

export interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

export interface Metadata {
    upload_max_filesize: string;
    upload_max_filesize_bytes: number;
    upload_allowed_extensions: string;
}
