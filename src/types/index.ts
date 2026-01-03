export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';

export interface Tag {
    id: string;
    name: string;
    color: string;
    user_id: string;
}

export interface List {
    id: string;
    name: string;
    color?: string;
    icon?: string;
    order_index: number;
    user_id: string;
    folder_id?: string | null;
    updated_at: string;
}

export interface Folder {
    id: string;
    name: string;
    order_index: number;
    user_id: string;
    updated_at: string;
}

export interface Task {
    id: string;
    user_id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    is_project: boolean;
    due_date?: string | null;
    due_time?: string | null;
    end_date?: string | null;
    end_time?: string | null;
    priority: TaskPriority;
    list_id?: string | null;
    parent_id?: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
    tags?: Tag[];
}

// Только данные настроек
export interface UserSettingsData {
    isNightHidden: boolean;
    workingStart: number;
    workingEnd: number;
}